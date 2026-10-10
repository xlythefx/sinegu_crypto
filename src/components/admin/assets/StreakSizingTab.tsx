import { useCallback, useMemo, useState } from 'react'
import { HelpCircle, Info } from 'lucide-react'
import ExchangeSection from './ExchangeSection'
import StreakSizingCard from './StreakSizingCard'
import StreakSizingGuideModal from './StreakSizingGuideModal'
import { EXCHANGE_META, exchangeFromBroker } from '../../exchanges/meta'
import {
  coinCount,
  groupByExchange,
  groupLabel,
  notTradingNote,
  type ExchangeFilter,
} from './exchangeGroups'
import { useAssetStreaks } from '../../../hooks/useAssetStreaks'
import { displaySymbol } from '../../../lib/chart'
import { isKilled } from '../../../lib/killSwitch'
import { draftTouched, type StreakSizingDraft } from '../../../lib/streakSizing'
import type { AdminAsset } from '../../../types/admin'
import type { ExchangeKind } from '../../../types/exchanges'

const INPUT =
  'h-[38px] rounded-field border border-border bg-surface2 px-3 text-[13px] text-text outline-none focus:border-accent'

/**
 * The short version, always on screen. The full explanation — the worked
 * example, the balance scaling, the fine print — is one click away in
 * StreakSizingGuideModal, so the tab itself never shows an example figure
 * that could be mistaken for a real setting.
 */
function HowItWorks() {
  const [open, setOpen] = useState(false)
  return (
    <section
      className="flex items-start gap-3 rounded-card border border-border bg-surface p-card"
      data-aos="fade-up"
    >
      <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent-soft text-accent">
        <Info size={15} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-[15px] font-extrabold">How streak sizing works</h2>
        <p className="mt-1.5 text-[13px] leading-[1.6] text-muted">
          After a number of losses or wins in a row on a coin, the bot opens that account’s next
          trade at the size you set for that step. No step for the current run means the normal
          size.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent hover:underline"
        >
          <HelpCircle size={14} aria-hidden="true" />
          Get to know more
        </button>
      </div>
      <StreakSizingGuideModal open={open} onClose={() => setOpen(false)} />
    </section>
  )
}

interface StreakSizingTabProps {
  assets: AdminAsset[]
  /** The page's exchange switcher (`?exchange=`): every venue, or one. */
  exchange: ExchangeFilter
  /** Venues the engine trades right now; null = unknown (say nothing). */
  traded: ReadonlySet<ExchangeKind> | null
  /** Re-read the asset list after a save (the Assets tab shows the ladder too). */
  onSaved: () => void
}

/**
 * Admin → Trading Assets → Streak Sizing Settings: every asset's ladder,
 * one section per exchange (LTC on Binance and LTC on MEXC are two ladders),
 * and inside a section coins the kill switch has stopped first, then assets
 * already using streak sizing.
 *
 * Drafts live HERE, not in the cards: the grid re-mounts on every search
 * keystroke and exchange switch (the filter-switch reveal), and an admin who
 * moves on to the next coin must not lose the sizes they typed on this one.
 */
export default function StreakSizingTab({
  assets,
  exchange,
  traded,
  onSaved,
}: StreakSizingTabProps) {
  const [search, setSearch] = useState('')
  const [drafts, setDrafts] = useState<Record<number, StreakSizingDraft>>({})
  // A saved asset shows its new ladder at once, until the reloaded list
  // (a new array) replaces the one the save was made against.
  const [saved, setSaved] = useState<{ from: AdminAsset[]; byId: Record<number, AdminAsset> }>({
    from: assets,
    byId: {},
  })

  const ids = useMemo(() => assets.map((a) => a.asset_id), [assets])
  const { entries, refresh } = useAssetStreaks(ids)

  const current = useMemo(() => {
    const byId = saved.from === assets ? saved.byId : {}
    return assets.map((a) => byId[a.asset_id] ?? a)
  }, [assets, saved])

  const sorted = useMemo(
    () =>
      [...current].sort(
        (a, b) =>
          Number(isKilled(b)) - Number(isKilled(a)) ||
          Number(b.streak_sizing_enabled) - Number(a.streak_sizing_enabled) ||
          a.ticker.localeCompare(b.ticker) ||
          (a.broker ?? '').localeCompare(b.broker ?? ''),
      ),
    [current],
  )

  const query = search.trim().toLowerCase()
  const matches = (a: AdminAsset) =>
    !query ||
    a.ticker.toLowerCase().includes(query) ||
    displaySymbol(a.ticker).toLowerCase().includes(query)

  // One section per exchange, each keeping the sort above. The search only
  // narrows what a section SHOWS; its header counts every coin it has.
  const sections = groupByExchange(sorted, exchange).map((g) => ({
    ...g,
    shown: g.assets.filter(matches),
  }))
  // Searching across every venue: a venue with no match is noise, so it
  // drops out. One venue picked: its section stays, saying nothing matched.
  const visibleSections =
    query && exchange === 'all' ? sections.filter((s) => s.shown.length > 0) : sections

  // The toolbar describes what the switcher selected.
  const inScope = (a: AdminAsset) =>
    exchange === 'all' || exchangeFromBroker(a.broker) === exchange
  const scoped = current.filter(inScope)
  const onCount = scoped.filter((a) => a.streak_sizing_enabled).length
  const killedCount = scoped.filter(isKilled).length
  // Drafts are page-wide, so an unsaved one on a venue the switcher hides is
  // still counted — and said to be elsewhere, or it would look lost.
  const unsavedAssets = current.filter((a) => {
    const draft = drafts[a.asset_id]
    return (
      draft &&
      draftTouched(
        { enabled: a.streak_sizing_enabled, steps: a.streak_sizes, killSwitch: a.kill_switch_losses },
        draft,
      )
    )
  })
  const unsaved = unsavedAssets.length
  const unsavedElsewhere = unsavedAssets.filter((a) => !inScope(a)).length

  const setDraft = useCallback((assetId: number, draft: StreakSizingDraft | null) => {
    setDrafts((all) => {
      const next = { ...all }
      if (draft) next[assetId] = draft
      else delete next[assetId]
      return next
    })
  }, [])

  /** Show a changed asset at once, until the reloaded list replaces it. */
  const showChanged = useCallback(
    (asset: AdminAsset) =>
      setSaved((s) => ({
        from: assets,
        byId: { ...(s.from === assets ? s.byId : {}), [asset.asset_id]: asset },
      })),
    [assets],
  )

  const handleSaved = useCallback(
    (asset: AdminAsset) => {
      setDraft(asset.asset_id, null)
      showChanged(asset)
      refresh(asset.asset_id)
      onSaved()
    },
    [showChanged, refresh, onSaved, setDraft],
  )

  // Turned back on after the kill switch: only `enabled` moved, so a draft
  // the admin is in the middle of stays.
  const handleAssetChanged = useCallback(
    (asset: AdminAsset) => {
      showChanged(asset)
      onSaved()
    },
    [showChanged, onSaved],
  )

  return (
    <div className="flex flex-col gap-stack">
      <HowItWorks />

      {/* The toolbar is its own card and the asset cards sit directly under
          it, not inside it: a card in a padded card leaves a phone-width step
          row too little room for its controls. */}
      <section
        className="flex flex-wrap items-center justify-between gap-3.5 rounded-card border border-border bg-surface p-card"
        data-aos="fade-up"
      >
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-extrabold">Sizes per asset</h2>
          <p className="mt-px text-[12px] text-muted">
            {onCount} of {scoped.length} {scoped.length === 1 ? 'asset uses' : 'assets use'}{' '}
            streak sizing
            {exchange !== 'all' && ` on ${EXCHANGE_META[exchange].label}`}
            {killedCount > 0 && (
              <span className="font-semibold text-red">
                {' '}
                · {killedCount} switched off by the kill switch
              </span>
            )}
            {unsaved > 0 && (
              <span className="font-semibold text-accent">
                {' '}
                · {unsaved} unsaved
                {unsavedElsewhere > 0 &&
                  ` (${unsavedElsewhere} on ${unsavedElsewhere === 1 ? 'another exchange' : 'other exchanges'})`}
              </span>
            )}
          </p>
        </div>
        <input
          type="search"
          className={`${INPUT} w-full min-w-0 sm:w-[220px]`}
          placeholder="Search by ticker…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search assets by ticker"
        />
      </section>

      {/* Re-mounted on every search and exchange switch so the new set
          reveals (project convention). The search box stays outside, or each
          keystroke would unmount it and drop focus; drafts and streak counts
          live above, so nothing typed or fetched is lost. */}
      <div key={`${exchange}-${query}`} className="animate-[fadeup_0.35s_ease-out]">
        {visibleSections.length === 0 ? (
          <p className="rounded-card border border-dashed border-border bg-surface px-4 py-10 text-center text-[13px] text-muted">
            No asset matches “{search.trim()}”.
          </p>
        ) : (
          <div className="flex flex-col gap-7">
            {visibleSections.map((s) => {
              const label = groupLabel(s.exchange)
              const on = s.assets.filter((a) => a.streak_sizing_enabled).length
              const killed = s.assets.filter(isKilled).length
              return (
                <ExchangeSection
                  key={s.exchange ?? 'none'}
                  exchange={s.exchange}
                  summary={
                    s.assets.length === 0 ? (
                      `No ${label} coins yet — add one on the Assets tab.`
                    ) : (
                      <>
                        {coinCount(s.assets.length)} · {on} using streak sizing
                        {killed > 0 && (
                          <span className="font-semibold text-red"> · {killed} switched off</span>
                        )}
                      </>
                    )
                  }
                  note={notTradingNote(
                    s.exchange,
                    traded,
                    'these sizes apply once it is switched on.',
                  )}
                >
                  {s.assets.length === 0 ? null : s.shown.length === 0 ? (
                    <p className="rounded-card border border-dashed border-border bg-surface px-4 py-6 text-center text-[13px] text-muted">
                      No {label} coin matches “{search.trim()}”.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-stack min-[1180px]:grid-cols-2">
                      {s.shown.map((asset) => (
                        <StreakSizingCard
                          key={asset.asset_id}
                          asset={asset}
                          draft={drafts[asset.asset_id]}
                          onDraftChange={setDraft}
                          streaks={entries[asset.asset_id]}
                          onSaved={handleSaved}
                          onAssetChanged={handleAssetChanged}
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
    </div>
  )
}
