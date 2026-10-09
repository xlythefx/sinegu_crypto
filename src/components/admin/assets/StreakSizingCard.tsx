import { useMemo, useState } from 'react'
import { Activity } from 'lucide-react'
import StreakSizingFields from './StreakSizingFields'
import ConfirmModal from '../../ui/ConfirmModal'
import { saveAssetStreakSizing } from '../../../services/admin'
import { getApiErrorMessage } from '../../../services/api'
import { displaySymbol } from '../../../lib/chart'
import {
  describeLadderChanges,
  describeRuns,
  draftTouched,
  fmtSize,
  ladderHasErrors,
  ladderSummaryText,
  rowsFromSteps,
  sameLadder,
  stepsFromRows,
  type StreakSizingDraft,
} from '../../../lib/streakSizing'
import type { AssetStreaksEntry } from '../../../hooks/useAssetStreaks'
import type { AdminAsset, AssetStreakSize } from '../../../types/admin'

const BTN =
  'inline-flex h-9 items-center justify-center rounded-pill px-4 text-[12.5px] font-bold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45'

interface StreakSizingCardProps {
  asset: AdminAsset
  /** Unsaved edits, held by the tab so a search re-mount never drops them. */
  draft: StreakSizingDraft | undefined
  /** null = discard the draft (back to what is saved). */
  onDraftChange: (assetId: number, draft: StreakSizingDraft | null) => void
  streaks: AssetStreaksEntry | undefined
  onSaved: (asset: AdminAsset) => void
}

/**
 * "Right now: 3 accounts normal · 4 after 2+ losses · 1 after 3+ wins" —
 * every account's CURRENT run, placed on the ladder in the editor (so an
 * unsaved step shows who it would catch). Quiet while loading or failed.
 */
function RightNow({
  entry,
  steps,
  enabled,
  unsaved,
}: {
  entry: AssetStreaksEntry | undefined
  steps: readonly AssetStreakSize[]
  enabled: boolean
  /** The switch or the steps differ from what is saved. */
  unsaved: boolean
}) {
  const data = entry?.data
  let text: string
  if (!data) {
    text = entry?.failed ? 'Could not load the current streaks.' : 'Checking current streaks…'
  } else if (data.exchange === null) {
    text = 'Not linked to Binance, Bybit or MEXC, so no streaks to count.'
  } else if (data.accounts === 0) {
    text = 'No accounts trade on this exchange yet.'
  } else {
    text = `Right now: ${describeRuns(data, steps).join(' · ')}`
  }
  const counted = data !== null && data !== undefined && data.accounts > 0

  return (
    <p className="flex items-start gap-2 text-[12px] leading-[1.5] text-muted" aria-live="polite">
      <Activity size={13} className="mt-[3px] flex-none text-faint" aria-hidden="true" />
      <span className={data ? '' : 'text-faint'}>
        {text}
        {counted && !enabled && <span className="text-faint"> · not applied while off</span>}
        {counted && enabled && unsaved && steps.length > 0 && (
          <span className="text-faint"> · with your unsaved changes</span>
        )}
      </span>
    </p>
  )
}

/**
 * One asset's streak ladder: the switch, the step editor, where the accounts
 * sit on it right now, and a confirmed save. Nothing is written until
 * Save → Yes — the switch and the rows are a draft.
 */
export default function StreakSizingCard({
  asset,
  draft,
  onDraftChange,
  streaks,
  onSaved,
}: StreakSizingCardProps) {
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const savedState = useMemo(
    () => ({ enabled: asset.streak_sizing_enabled, steps: asset.streak_sizes }),
    [asset.streak_sizing_enabled, asset.streak_sizes],
  )
  // Built once per saved ladder, so the row ids (React keys) stay put until
  // the first edit copies them into the draft.
  const savedRows = useMemo(() => rowsFromSteps(asset.streak_sizes), [asset.streak_sizes])

  const enabled = draft?.enabled ?? asset.streak_sizing_enabled
  const rows = draft?.rows ?? savedRows
  const touched = draft ? draftTouched(savedState, draft) : false
  const hasErrors = ladderHasErrors(rows)
  const nextSteps = stepsFromRows(rows)
  const stepsChanged = !sameLadder(nextSteps, asset.streak_sizes)
  const canSave =
    touched && !hasErrors && (enabled !== asset.streak_sizing_enabled || stepsChanged)

  const update = (next: Partial<StreakSizingDraft>) => {
    setError(null)
    onDraftChange(asset.asset_id, { enabled, rows, ...next })
  }

  const reset = () => {
    setError(null)
    onDraftChange(asset.asset_id, null)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const updated = await saveAssetStreakSizing(asset.asset_id, {
        streak_sizing_enabled: enabled,
        streak_sizes: nextSteps,
      })
      setConfirming(false)
      onSaved(updated)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the streak sizes.'))
      setConfirming(false)
    } finally {
      setSaving(false)
    }
  }

  const symbol = displaySymbol(asset.ticker)
  const changes = describeLadderChanges(savedState, { enabled, steps: nextSteps })
  // A win step above base fills the max position size sooner — the cap still
  // holds the total, so the admin should know before saving one.
  const winAboveBase = nextSteps.some((s) => s.kind === 'win' && s.size > asset.base_size)
  const outcome = !enabled
    ? 'While it is off every entry uses the normal size; your steps are kept.'
    : nextSteps.length === 0
      ? 'There are no steps yet, so every entry still uses the normal size.'
      : `New ladder: ${ladderSummaryText(asset.base_size, nextSteps)}. Applies from the next entry; exits are never affected.${
          winAboveBase
            ? ` Win sizes above normal still stop at the max position size (${fmtSize(asset.max_increments)}), so a stack reaches it in fewer entries.`
            : ''
        }`
  const confirmMessage = `${changes.join(' · ')}. ${outcome}`

  const meta = [asset.broker ?? 'No exchange', `Base size ${fmtSize(asset.base_size)}`]
  if (!asset.enabled) meta.push('asset is off')

  return (
    <article
      className={`flex flex-col gap-4 rounded-card border bg-surface p-4 transition-[border-color] duration-150 sm:p-5 ${
        touched ? 'border-accent-line' : 'border-border'
      }`}
    >
      <header className="flex items-center gap-3">
        {asset.asset_image ? (
          <img
            className="h-10 w-10 flex-none rounded-full border border-border bg-surface2 object-cover"
            src={asset.asset_image}
            alt=""
          />
        ) : (
          <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full bg-accent-soft font-mono text-[15px] font-bold text-accent">
            {asset.ticker[0]}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[15px] font-extrabold tracking-[-0.01em]">
            {symbol}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-muted">{meta.join(' · ')}</p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`Streak sizing for ${symbol}`}
          className="inline-flex flex-none items-center gap-2 rounded-pill bg-transparent py-1 pl-2 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => update({ enabled: !enabled })}
          disabled={saving}
        >
          <span
            className={`text-[12.5px] font-semibold ${enabled ? 'text-green' : 'text-muted'}`}
          >
            {enabled ? 'On' : 'Off'}
          </span>
          <span
            className={`relative inline-block h-5 w-9 flex-none rounded-pill border transition-[background,border-color] duration-150 ${
              enabled ? 'border-accent bg-accent-soft' : 'border-border bg-surface2'
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-[14px] w-[14px] rounded-full transition-[transform,background] duration-150 ${
                enabled ? 'translate-x-4 bg-accent' : 'bg-muted'
              }`}
            />
          </span>
        </button>
      </header>

      {!enabled && (
        <p className="-mt-1 text-[12px] leading-[1.5] text-faint">
          Off: every entry uses the normal size. Steps you set here are kept
          for when you turn it on.
        </p>
      )}

      <StreakSizingFields
        ticker={asset.ticker}
        base={asset.base_size}
        rows={rows}
        onChange={(next) => update({ rows: next })}
        baseNote="Base size, edited on the Assets tab"
        muted={!enabled}
      />

      <RightNow
        entry={streaks}
        steps={nextSteps}
        enabled={enabled}
        unsaved={enabled !== asset.streak_sizing_enabled || stepsChanged}
      />

      {error && (
        <p
          className="rounded-field border border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] px-3.5 py-2.5 text-[12.5px] text-red"
          role="alert"
        >
          {error}
        </p>
      )}

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-hair pt-3.5">
        <span
          className={`text-[11.5px] font-semibold ${
            hasErrors ? 'text-red' : touched ? 'text-accent' : 'text-faint'
          }`}
        >
          {hasErrors ? 'Fix the steps marked in red' : touched ? 'Unsaved changes' : 'No changes'}
        </span>
        <div className="flex flex-none gap-2">
          <button
            type="button"
            className={`${BTN} border border-border bg-surface2 text-text hover:border-accent`}
            onClick={reset}
            disabled={!touched || saving}
          >
            Reset
          </button>
          <button
            type="button"
            className={`${BTN} border-0 bg-accent text-on-accent`}
            onClick={() => setConfirming(true)}
            disabled={!canSave || saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </footer>

      <ConfirmModal
        open={confirming}
        title={`Save streak sizing for ${symbol}?`}
        message={confirmMessage}
        confirmLabel={saving ? 'Saving…' : 'Yes, save'}
        cancelLabel="No"
        onConfirm={() => !saving && save()}
        onCancel={() => !saving && setConfirming(false)}
      />
    </article>
  )
}
