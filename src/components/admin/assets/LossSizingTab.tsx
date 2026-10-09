import { useCallback, useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import LossSizingCard from './LossSizingCard'
import { useAssetLossStreaks } from '../../../hooks/useAssetLossStreaks'
import { displaySymbol } from '../../../lib/chart'
import { draftTouched, type LossSizingDraft } from '../../../lib/lossSizing'
import type { AdminAsset } from '../../../types/admin'

const INPUT =
  'h-[38px] rounded-field border border-border bg-surface2 px-3 text-[13px] text-text outline-none focus:border-accent'

const RULES = [
  'After a run of losing trades on a coin, the next entry uses the size you set for that step instead of Base size (the normal size). Every account counts its own trades.',
  'One win puts it straight back to the normal size. Wins never make the size bigger.',
  'Leave a step blank to keep the size of the step above it. The deepest step keeps applying until the next win.',
  'Sizes grow with balance exactly like Base size (per 1,000 USDT). Only new entries change; exits are never affected.',
]

const FOOTNOTE =
  'A stacked position that closes together counts as one trade. Any profit after fees is a win; break-even counts as a loss. A new account starts on the normal size. The asset’s max position size still caps every stack.'

function HowItWorks() {
  return (
    <section
      className="flex items-start gap-3 rounded-card border border-border bg-surface p-card"
      data-aos="fade-up"
    >
      <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent-soft text-accent">
        <Info size={15} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-[15px] font-extrabold">How loss-streak sizing works</h2>
        <ul className="mt-2.5 grid gap-x-6 gap-y-2 lg:grid-cols-2">
          {RULES.map((rule) => (
            <li key={rule} className="flex items-start gap-2 text-[12.5px] leading-[1.55] text-muted">
              <span
                className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-accent"
                aria-hidden="true"
              />
              {rule}
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-hair pt-3 text-[11.5px] leading-[1.55] text-faint">
          {FOOTNOTE}
        </p>
      </div>
    </section>
  )
}

interface LossSizingTabProps {
  assets: AdminAsset[]
  /** Re-read the asset list after a save (the Assets tab shows the ladder too). */
  onSaved: () => void
}

/**
 * Admin → Trading Assets → Loss-streak sizing: every asset's ladder side by
 * side, assets already using it first.
 *
 * Drafts live HERE, not in the cards: the grid re-mounts on every search
 * keystroke (the filter-switch reveal), and an admin who searches for the
 * next coin must not lose the sizes they typed on this one.
 */
export default function LossSizingTab({ assets, onSaved }: LossSizingTabProps) {
  const [search, setSearch] = useState('')
  const [drafts, setDrafts] = useState<Record<number, LossSizingDraft>>({})
  // A saved asset shows its new ladder at once, until the reloaded list
  // (a new array) replaces the one the save was made against.
  const [saved, setSaved] = useState<{ from: AdminAsset[]; byId: Record<number, AdminAsset> }>({
    from: assets,
    byId: {},
  })

  const ids = useMemo(() => assets.map((a) => a.asset_id), [assets])
  const { entries, refresh } = useAssetLossStreaks(ids)

  const current = useMemo(() => {
    const byId = saved.from === assets ? saved.byId : {}
    return assets.map((a) => byId[a.asset_id] ?? a)
  }, [assets, saved])

  const sorted = useMemo(
    () =>
      [...current].sort(
        (a, b) =>
          Number(b.loss_sizing_enabled) - Number(a.loss_sizing_enabled) ||
          a.ticker.localeCompare(b.ticker) ||
          (a.broker ?? '').localeCompare(b.broker ?? ''),
      ),
    [current],
  )

  const query = search.trim().toLowerCase()
  const shown = query
    ? sorted.filter(
        (a) =>
          a.ticker.toLowerCase().includes(query) ||
          displaySymbol(a.ticker).toLowerCase().includes(query),
      )
    : sorted

  const onCount = current.filter((a) => a.loss_sizing_enabled).length
  const unsaved = current.filter((a) => {
    const draft = drafts[a.asset_id]
    return draft && draftTouched({ enabled: a.loss_sizing_enabled, steps: a.loss_sizes }, draft)
  }).length

  const setDraft = useCallback((assetId: number, draft: LossSizingDraft | null) => {
    setDrafts((all) => {
      const next = { ...all }
      if (draft) next[assetId] = draft
      else delete next[assetId]
      return next
    })
  }, [])

  const handleSaved = useCallback(
    (asset: AdminAsset) => {
      setDraft(asset.asset_id, null)
      setSaved((s) => ({
        from: assets,
        byId: { ...(s.from === assets ? s.byId : {}), [asset.asset_id]: asset },
      }))
      refresh(asset.asset_id)
      onSaved()
    },
    [assets, refresh, onSaved, setDraft],
  )

  return (
    <div className="flex flex-col gap-stack">
      <HowItWorks />

      {/* The toolbar is its own card and the asset cards sit directly under
          it, not inside it: a card in a padded card leaves a phone-width step
          row too little room for its label. */}
      <section
        className="flex flex-wrap items-center justify-between gap-3.5 rounded-card border border-border bg-surface p-card"
        data-aos="fade-up"
      >
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-extrabold">Sizes per asset</h2>
          <p className="mt-px text-[12px] text-muted">
            {onCount} of {assets.length} {assets.length === 1 ? 'asset uses' : 'assets use'}{' '}
            streak sizing
            {unsaved > 0 && (
              <span className="font-semibold text-accent"> · {unsaved} unsaved</span>
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

      {/* Re-mounted on every search so the new set reveals (project
          convention). The search box stays outside, or each keystroke would
          unmount it and drop focus; drafts and streak counts live above, so
          nothing typed or fetched is lost. */}
      <div key={query} className="animate-[fadeup_0.35s_ease-out]">
        {shown.length === 0 ? (
          <p className="rounded-card border border-dashed border-border bg-surface px-4 py-10 text-center text-[13px] text-muted">
            {assets.length === 0
              ? 'No assets yet. Create one on the Assets tab first.'
              : `No asset matches “${search.trim()}”.`}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-stack min-[1180px]:grid-cols-2">
            {shown.map((asset) => (
              <LossSizingCard
                key={asset.asset_id}
                asset={asset}
                draft={drafts[asset.asset_id]}
                onDraftChange={setDraft}
                streaks={entries[asset.asset_id]}
                onSaved={handleSaved}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
