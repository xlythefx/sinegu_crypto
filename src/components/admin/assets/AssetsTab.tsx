import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import AssetCard from '../AssetCard'
import AssetFormModal from '../AssetFormModal'
import ExchangeSection from './ExchangeSection'
import ConfirmModal from '../../ui/ConfirmModal'
import { EXCHANGE_META } from '../../exchanges/meta'
import {
  coinCount,
  groupByExchange,
  groupLabel,
  notTradingNote,
  type ExchangeFilter,
} from './exchangeGroups'
import {
  createAsset,
  deleteAsset,
  setAssetEnabled,
  updateAsset,
  type AssetImageChange,
} from '../../../services/admin'
import { getApiErrorMessage } from '../../../services/api'
import { displaySymbol } from '../../../lib/chart'
import { isKilled, reviveConfirmCopy } from '../../../lib/killSwitch'
import type { AdminAsset, AssetInput } from '../../../types/admin'
import type { ExchangeKind } from '../../../types/exchanges'

const INPUT =
  'h-[38px] rounded-field border border-border bg-surface2 px-3 text-[13px] text-text outline-none focus:border-accent [&>option]:bg-surface [&>option]:text-text'
const ADD_BTN =
  'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-pill border border-border bg-surface2 px-3.5 text-[12.5px] font-semibold text-text transition-[border-color] duration-150 hover:border-accent'
const EMPTY_BOX =
  'rounded-card border border-dashed border-border bg-surface px-4 py-6 text-center text-[13px] text-muted'

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
 * Admin → Trading Assets → Assets: one section per exchange, each with its
 * own "Add coin" button, under a toolbar whose search and filters apply
 * inside every section. The same coin is one row per venue, so a flat grid
 * showed LTC on Binance and LTC on MEXC as twins.
 *
 * Every write goes through ConfirmModal first.
 */
export default function AssetsTab({ assets, exchange, traded, onChanged }: AssetsTabProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [tickerFilter, setTickerFilter] = useState('all')

  // create/edit modal
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AdminAsset | null>(null)
  /** The broker a create opens on — the section's venue, or the switcher's. */
  const [createBroker, setCreateBroker] = useState<string | null>(null)
  const [pending, setPending] = useState<
    { input: AssetInput; image: AssetImageChange } | null
  >(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // toggle + delete confirmations
  const [toggling, setToggling] = useState<AdminAsset | null>(null)
  const [deleting, setDeleting] = useState<AdminAsset | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const types = useMemo(
    () =>
      Array.from(
        new Set(assets.map((a) => (a.type ?? '').trim()).filter(Boolean))
      ).sort(),
    [assets]
  )
  const tickers = useMemo(
    () => Array.from(new Set(assets.map((a) => a.ticker))).sort(),
    [assets]
  )

  const filtersActive =
    search.trim() !== '' || typeFilter !== 'all' || tickerFilter !== 'all'

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matches = (a: AdminAsset) =>
      (!q ||
        a.ticker.toLowerCase().includes(q) ||
        (a.type ?? '').toLowerCase().includes(q) ||
        (a.broker ?? '').toLowerCase().includes(q)) &&
      (typeFilter === 'all' || (a.type ?? '') === typeFilter) &&
      (tickerFilter === 'all' || a.ticker === tickerFilter)
    // Grouped from the WHOLE list, so a header counts every coin its venue
    // has; the filters only narrow what each section shows.
    return groupByExchange(assets, exchange).map((g) => ({
      ...g,
      shown: g.assets.filter(matches),
    }))
  }, [assets, exchange, search, typeFilter, tickerFilter])

  // Filtering across every venue: a venue with no match is noise, so it drops
  // out. One venue picked: its section stays, saying nothing matched.
  const visibleSections =
    filtersActive && exchange === 'all'
      ? sections.filter((s) => s.shown.length > 0)
      : sections

  const shownCount = sections.reduce((n, s) => n + s.shown.length, 0)
  const shownOn = sections.reduce((n, s) => n + s.shown.filter((a) => a.enabled).length, 0)
  const scopeLabel = exchange === 'all' ? null : EXCHANGE_META[exchange].label

  const openCreate = (broker: string | null) => {
    setEditing(null)
    setCreateBroker(broker)
    setFormError(null)
    setFormOpen(true)
  }

  const openEdit = (asset: AdminAsset) => {
    setEditing(asset)
    setFormError(null)
    setFormOpen(true)
  }

  /** Step 1: form submit → hold input + image and ask for confirmation. */
  const onFormSubmit = (input: AssetInput, image: AssetImageChange) => {
    setPending({ input, image })
  }

  /** Step 2: confirmed → hit the API (multipart, with the optional image). */
  const onConfirmSave = async () => {
    if (!pending) return
    setSaving(true)
    setFormError(null)
    try {
      if (editing) {
        await updateAsset(editing.asset_id, pending.input, pending.image)
      } else {
        await createAsset(pending.input, pending.image)
      }
      setPending(null)
      setFormOpen(false)
      setEditing(null)
      onChanged()
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Could not save the asset.'))
      setPending(null)
    } finally {
      setSaving(false)
    }
  }

  const onConfirmToggle = async () => {
    if (!toggling) return
    setActionBusy(true)
    setActionError(null)
    try {
      // Only `enabled` changes; the ladder and the kill switch are left out
      // so the API keeps them. On a killed coin this is "turn it back on".
      await setAssetEnabled(toggling, !toggling.enabled)
      setToggling(null)
      onChanged()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not update the asset.'))
      setToggling(null)
    } finally {
      setActionBusy(false)
    }
  }

  const onConfirmDelete = async () => {
    if (!deleting) return
    setActionBusy(true)
    setActionError(null)
    try {
      await deleteAsset(deleting.asset_id)
      setDeleting(null)
      onChanged()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not delete the asset.'))
      setDeleting(null)
    } finally {
      setActionBusy(false)
    }
  }

  // Turning a coin the kill switch stopped back on also restarts its count,
  // so both confirmations say so.
  const toggleKilled = toggling !== null && isKilled(toggling)
  const revive = toggling ? reviveConfirmCopy(displaySymbol(toggling.ticker)) : null
  const formRevives =
    editing !== null && isKilled(editing) && pending !== null && pending.input.enabled
  // Two cards can share a ticker now, so every confirmation names the venue.
  const named = (a: AdminAsset | null) =>
    a ? `${a.ticker}${a.broker ? ` on ${a.broker}` : ''}` : ''

  return (
    <div className="flex flex-col gap-stack">
      {/* Toolbar: its own card, outside the re-keyed region below, so typing
          in the search box never unmounts it. */}
      <section
        className="flex flex-wrap items-start justify-between gap-3.5 rounded-card border border-border bg-surface p-card"
        data-aos="fade-up"
      >
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-extrabold">
            {scopeLabel ? `${scopeLabel} assets` : 'All Assets'}
          </h2>
          <p className="mt-px text-[12px] text-muted">
            {filtersActive ? 'Showing ' : ''}
            {shownCount} {shownCount === 1 ? 'asset' : 'assets'}
            <span className="text-faint">
              {' · '}
              {shownOn} tradable, {shownCount - shownOn} off
            </span>
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <input
            type="search"
            className={`${INPUT} min-w-0 flex-1 sm:min-w-[190px] sm:flex-none`}
            placeholder="Search by ticker, type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search assets"
          />
          <select
            className={INPUT}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by type"
          >
            <option value="all">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            className={INPUT}
            value={tickerFilter}
            onChange={(e) => setTickerFilter(e.target.value)}
            aria-label="Filter by ticker"
          >
            <option value="all">All tickers</option>
            {tickers.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="inline-flex h-[38px] items-center gap-1.5 rounded-pill bg-accent px-4 text-[13px] font-bold text-on-accent"
            onClick={() => openCreate(scopeLabel)}
          >
            <Plus size={15} />
            New Asset
          </button>
        </div>
      </section>

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
      <div
        key={`${exchange}-${search}-${typeFilter}-${tickerFilter}`}
        className="animate-[fadeup_0.35s_ease-out]"
      >
        {visibleSections.length === 0 ? (
          <p className={`${EMPTY_BOX} py-10`}>
            No assets match your search. Adjust the filters or create a new asset.
          </p>
        ) : (
          <div className="flex flex-col gap-7">
            {visibleSections.map((s) => {
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
                        ? `${s.shown.length} of ${coinCount(s.assets.length)} match · ${on} on`
                        : `${coinCount(s.assets.length)} · ${on} on`
                  }
                  note={
                    s.exchange === null
                      ? 'The bot only trades coins linked to Binance, Bybit or MEXC. Edit a coin to pick its exchange.'
                      : notTradingNote(
                          s.exchange,
                          traded,
                          'coins added here wait until it is switched on.',
                        )
                  }
                  action={
                    s.exchange && (
                      <button
                        type="button"
                        className={ADD_BTN}
                        onClick={() => openCreate(label)}
                      >
                        <Plus size={14} aria-hidden="true" />
                        Add {label} coin
                      </button>
                    )
                  }
                >
                  {empty ? null : s.shown.length === 0 ? (
                    <p className={EMPTY_BOX}>No {label} coin matches the filters.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3.5 min-[560px]:grid-cols-2 min-[1180px]:grid-cols-3">
                      {s.shown.map((asset) => (
                        <AssetCard
                          key={asset.asset_id}
                          asset={asset}
                          busy={actionBusy}
                          onToggle={setToggling}
                          onEdit={openEdit}
                          onDelete={setDeleting}
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

      <AssetFormModal
        open={formOpen}
        asset={editing}
        saving={saving}
        error={formError}
        defaultBroker={editing ? null : createBroker}
        onSubmit={onFormSubmit}
        onCancel={() => {
          setFormOpen(false)
          setEditing(null)
        }}
      />

      <ConfirmModal
        open={pending !== null}
        title={editing ? 'Save changes?' : 'Create asset?'}
        message={
          editing
            ? `This will update the asset in the database.${
                formRevives
                  ? ' It also turns the coin back on: new trades start again on the next signal, and the kill switch counts the master’s losses again from now.'
                  : ''
              }`
            : `This will add ${pending?.input.ticker || 'a new asset'}${
                pending?.input.broker ? ` on ${pending.input.broker}` : ''
              } to the database.`
        }
        confirmLabel={editing ? 'Yes, save' : 'Yes, create'}
        cancelLabel="No"
        onConfirm={onConfirmSave}
        onCancel={() => setPending(null)}
      />

      <ConfirmModal
        open={toggling !== null}
        title={
          toggleKilled && revive
            ? revive.title
            : `${toggling?.enabled ? 'Disable' : 'Enable'} ${named(toggling)}?`
        }
        message={
          toggleKilled && revive
            ? revive.message
            : toggling?.enabled
              ? 'The bots will stop trading this asset.'
              : 'The bots will be allowed to trade this asset again.'
        }
        confirmLabel={
          toggleKilled && revive
            ? revive.confirmLabel
            : toggling?.enabled
              ? 'Yes, disable'
              : 'Yes, enable'
        }
        cancelLabel="No"
        danger={toggling?.enabled ?? false}
        onConfirm={onConfirmToggle}
        onCancel={() => setToggling(null)}
      />

      <ConfirmModal
        open={deleting !== null}
        title={`Delete ${named(deleting)}?`}
        message="This action cannot be undone. The asset will be permanently removed."
        confirmLabel="Yes, delete"
        cancelLabel="No"
        danger
        onConfirm={onConfirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
