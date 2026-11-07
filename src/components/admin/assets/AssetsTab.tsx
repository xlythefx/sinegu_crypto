import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import AssetCard from '../AssetCard'
import AssetHistoryModal from './AssetHistoryModal'
import AssetsToolbar, { type AssetFilterValues } from './AssetsToolbar'
import ExchangeSection from './ExchangeSection'
import ConfirmModal from '../../ui/ConfirmModal'
import { EXCHANGE_META } from '../../exchanges/meta'
import { coinCount, groupByExchange, groupLabel, notTradingNote, type ExchangeFilter } from './exchangeGroups'
import { deleteAsset, setAssetEnabled } from '../../../services/admin'
import { getApiErrorMessage } from '../../../services/api'
import { useUrlFilters } from '../../../hooks/useUrlFilters'
import { displaySymbol } from '../../../lib/chart'
import { isKilled, reviveConfirmCopy } from '../../../lib/killSwitch'
import {
  ASSET_STATUSES,
  matchesQuery,
  matchesStatus,
  statusCounts,
  type AssetStatus,
} from '../../../lib/assetFilters'
import type { AdminAsset } from '../../../types/admin'
import type { ExchangeKind } from '../../../types/exchanges'

const ADD_BTN =
  'inline-flex h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-pill border border-border bg-surface2 px-4 text-[12.5px] font-semibold text-text transition-[border-color] duration-150 hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
const EMPTY_BOX = 'rounded-card border border-dashed border-border bg-surface px-4 py-6 text-center text-[13px] text-muted'

const FILTER_DEFAULTS: AssetFilterValues = { q: '', status: 'all', type: 'all' }

interface AssetsTabProps {
  assets: AdminAsset[]
  /** The page's exchange switcher (`?exchange=`): every venue, or one. */
  exchange: ExchangeFilter
  /** Venues the engine trades right now; null = unknown (say nothing). */
  traded: ReadonlySet<ExchangeKind> | null
  /** Re-read the asset list after any write. */
  onChanged: () => void
}

/**
 * Admin → Trading Assets → Assets: one section per exchange, each with its own
 * "Add coin" button, under the shared filter bar. Creating and editing a coin
 * are their own pages (`/admin/assets/new`, `/admin/assets/:id/edit`); the
 * quick actions on a card (on/off, delete) stay here, behind ConfirmModal.
 */
export default function AssetsTab({ assets, exchange, traded, onChanged }: AssetsTabProps) {
  const navigate = useNavigate()
  const filters = useUrlFilters(FILTER_DEFAULTS, { allowed: { status: ASSET_STATUSES } })
  const { q, type } = filters.filters
  const status = filters.filters.status as AssetStatus

  const [toggling, setToggling] = useState<AdminAsset | null>(null)
  const [deleting, setDeleting] = useState<AdminAsset | null>(null)
  const [historyFor, setHistoryFor] = useState<AdminAsset | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const types = useMemo(
    () => Array.from(new Set(assets.map((a) => (a.type ?? '').trim()).filter(Boolean))).sort(),
    [assets],
  )

  // Grouped from the WHOLE list, so a header counts every coin its venue has;
  // the filters only narrow what each section shows.
  const sections = useMemo(() => {
    const matches = (a: AdminAsset) =>
      matchesQuery(a, q) && matchesStatus(a, status) && (type === 'all' || (a.type ?? '') === type)
    return groupByExchange(assets, exchange).map((g) => ({ ...g, shown: g.assets.filter(matches) }))
  }, [assets, exchange, q, status, type])

  const inScope = useMemo(() => sections.flatMap((s) => s.assets), [sections])
  const counts = useMemo(() => statusCounts(inScope), [inScope])
  const filtersActive = filters.activeCount > 0
  // Filtering across every venue: a venue with no match is noise, so it drops
  // out. One venue picked: its section stays, saying nothing matched.
  const visible = filtersActive && exchange === 'all' ? sections.filter((s) => s.shown.length > 0) : sections
  const shownCount = sections.reduce((n, s) => n + s.shown.length, 0)
  const scopeLabel = exchange === 'all' ? null : EXCHANGE_META[exchange].label

  const openCreate = (broker: string | null) =>
    navigate(broker ? `/admin/assets/new?broker=${encodeURIComponent(broker)}` : '/admin/assets/new')
  const openEdit = (asset: AdminAsset) => navigate(`/admin/assets/${asset.asset_id}/edit`)

  const run = async (work: () => Promise<unknown>, fallback: string, done: () => void) => {
    setActionBusy(true)
    setActionError(null)
    try {
      await work()
      onChanged()
    } catch (err) {
      setActionError(getApiErrorMessage(err, fallback))
    } finally {
      done()
      setActionBusy(false)
    }
  }

  // Turning a coin the kill switch stopped back on also restarts its count.
  const toggleKilled = toggling !== null && isKilled(toggling)
  const revive = toggling ? reviveConfirmCopy(displaySymbol(toggling.ticker)) : null
  // The same coin can exist on two venues, so every confirmation names it.
  const named = (a: AdminAsset | null) => (a ? `${a.ticker}${a.broker ? ` on ${a.broker}` : ''}` : '')

  return (
    <div className="flex flex-col gap-stack">
      <div className="flex flex-wrap items-end justify-between gap-3" data-aos="fade-up">
        <div className="min-w-0">
          <h2 className="font-display text-[18px] font-extrabold leading-tight">
            {scopeLabel ? `${scopeLabel} coins` : 'All coins'}
          </h2>
          <p className="mt-1 text-[12.5px] text-muted">
            {coinCount(counts.all)} · <span className="text-green">{counts.on} trading</span> · {counts.off} off
            {counts.attention > 0 && <span className="text-accent"> · {counts.attention} need attention</span>}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-pill bg-accent px-5 text-[13.5px] font-bold text-on-accent transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={() => openCreate(scopeLabel)}
        >
          <Plus size={16} aria-hidden="true" />
          New coin
        </button>
      </div>

      <AssetsToolbar
        filters={filters}
        counts={counts}
        types={types}
        summary={filtersActive ? `Showing ${shownCount} of ${counts.all}` : coinCount(counts.all)}
      />

      {actionError && (
        <p
          className="rounded-field border border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] px-3.5 py-2.5 text-[13px] text-red"
          role="alert"
        >
          {actionError}
        </p>
      )}

      {/* Re-mounted on every exchange/filter change so the new set reveals
          instead of hard-cutting (project convention). */}
      <div key={`${exchange}-${q}-${status}-${type}`} className="animate-[fadeup_0.35s_ease-out]">
        {visible.length === 0 ? (
          <p className={`${EMPTY_BOX} py-10`}>No coin matches the filters. Clear them, or add a new coin.</p>
        ) : (
          <div className="flex flex-col gap-7">
            {visible.map((s) => {
              const label = groupLabel(s.exchange)
              const on = s.assets.filter((a) => a.enabled).length
              const empty = s.assets.length === 0
              return (
                <ExchangeSection
                  key={s.exchange ?? 'none'}
                  exchange={s.exchange}
                  summary={
                    empty
                      ? `No ${label} coins yet`
                      : filtersActive && s.shown.length < s.assets.length
                        ? `${s.shown.length} of ${coinCount(s.assets.length)} match · ${on} trading`
                        : `${coinCount(s.assets.length)} · ${on} trading`
                  }
                  note={
                    s.exchange === null
                      ? 'The bot only trades coins linked to Binance, Bybit or MEXC. Edit a coin to pick its exchange.'
                      : notTradingNote(s.exchange, traded, 'coins added here wait until it is switched on.')
                  }
                  action={
                    s.exchange && (
                      <button type="button" className={ADD_BTN} onClick={() => openCreate(label)}>
                        <Plus size={14} aria-hidden="true" />
                        Add {label} coin
                      </button>
                    )
                  }
                >
                  {empty ? null : s.shown.length === 0 ? (
                    <p className={EMPTY_BOX}>No {label} coin matches the filters.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3.5 min-[620px]:grid-cols-2 min-[1240px]:grid-cols-3">
                      {s.shown.map((asset) => (
                        <AssetCard
                          key={asset.asset_id}
                          asset={asset}
                          busy={actionBusy}
                          onToggle={setToggling}
                          onEdit={openEdit}
                          onDelete={setDeleting}
                          onHistory={setHistoryFor}
                          onAssetChanged={onChanged}
                        />
                      ))}
                    </div>
                  )}
                </ExchangeSection>
              )
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        open={toggling !== null}
        title={
          toggleKilled && revive ? revive.title : `${toggling?.enabled ? 'Switch off' : 'Switch on'} ${named(toggling)}?`
        }
        message={
          toggleKilled && revive
            ? revive.message
            : toggling?.enabled
              ? 'The bot stops opening new trades on this coin. Open positions still close on their exit signal.'
              : 'The bot starts opening trades on this coin again from the next signal.'
        }
        confirmLabel={toggleKilled && revive ? revive.confirmLabel : toggling?.enabled ? 'Yes, switch off' : 'Yes, switch on'}
        cancelLabel="No"
        danger={toggling?.enabled ?? false}
        onConfirm={() =>
          toggling &&
          // Only `enabled` changes; the ladder and the kill switch are left out
          // so the API keeps them. On a killed coin this is "turn it back on".
          run(() => setAssetEnabled(toggling, !toggling.enabled), 'Could not update the asset.', () => setToggling(null))
        }
        onCancel={() => setToggling(null)}
      />

      {historyFor && <AssetHistoryModal asset={historyFor} onClose={() => setHistoryFor(null)} />}

      <ConfirmModal
        open={deleting !== null}
        title={`Delete ${named(deleting)}?`}
        message="This cannot be undone. The bot stops opening trades on this coin here; positions already open still close on their exit signal."
        confirmLabel="Yes, delete"
        cancelLabel="No"
        danger
        onConfirm={() =>
          deleting && run(() => deleteAsset(deleting.asset_id), 'Could not delete the asset.', () => setDeleting(null))
        }
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
