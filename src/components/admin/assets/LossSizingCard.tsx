import { useMemo, useState } from 'react'
import { Activity } from 'lucide-react'
import LossSizingFields from './LossSizingFields'
import ConfirmModal from '../../ui/ConfirmModal'
import { saveAssetLossSizing } from '../../../services/admin'
import { getApiErrorMessage } from '../../../services/api'
import { displaySymbol } from '../../../lib/chart'
import {
  describeLadderChanges,
  describeStreakCounts,
  draftTouched,
  fmtSize,
  ladderHasErrors,
  ladderSummaryText,
  sameLadder,
  stepsFromValues,
  valuesFromSteps,
  type LossSizingDraft,
} from '../../../lib/lossSizing'
import type { LossStreakEntry } from '../../../hooks/useAssetLossStreaks'
import type { AdminAsset } from '../../../types/admin'

const BTN =
  'inline-flex h-9 items-center justify-center rounded-pill px-4 text-[12.5px] font-bold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45'

interface LossSizingCardProps {
  asset: AdminAsset
  /** Unsaved edits, held by the tab so a search re-mount never drops them. */
  draft: LossSizingDraft | undefined
  /** null = discard the draft (back to what is saved). */
  onDraftChange: (assetId: number, draft: LossSizingDraft | null) => void
  streaks: LossStreakEntry | undefined
  onSaved: (asset: AdminAsset) => void
}

/** "Right now: 41 accounts normal · 3 after 1 loss" — quiet while loading or failed. */
function RightNow({ entry, enabled }: { entry: LossStreakEntry | undefined; enabled: boolean }) {
  const data = entry?.data
  let text: string
  if (!data) {
    text = entry?.failed ? 'Could not load the current streaks.' : 'Checking current streaks…'
  } else if (data.exchange === null) {
    text = 'Not linked to Binance, Bybit or MEXC, so no streaks to count.'
  } else if (data.accounts === 0) {
    text = 'No accounts trade on this exchange yet.'
  } else {
    text = `Right now: ${describeStreakCounts(data).join(' · ')}`
  }

  return (
    <p className="flex items-start gap-2 text-[12px] leading-[1.5] text-muted" aria-live="polite">
      <Activity size={13} className="mt-[3px] flex-none text-faint" aria-hidden="true" />
      <span className={data ? '' : 'text-faint'}>
        {text}
        {data && data.accounts > 0 && !enabled && (
          <span className="text-faint"> · not applied while off</span>
        )}
      </span>
    </p>
  )
}

/**
 * One asset's loss-streak ladder: the switch, the step editor, how many
 * accounts sit on a streak right now, and a confirmed save. Nothing is
 * written until Save → Yes — the switch and the rows are a draft.
 */
export default function LossSizingCard({
  asset,
  draft,
  onDraftChange,
  streaks,
  onSaved,
}: LossSizingCardProps) {
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const savedState = useMemo(
    () => ({ enabled: asset.loss_sizing_enabled, steps: asset.loss_sizes }),
    [asset.loss_sizing_enabled, asset.loss_sizes],
  )
  const savedValues = useMemo(() => valuesFromSteps(asset.loss_sizes), [asset.loss_sizes])

  const enabled = draft?.enabled ?? asset.loss_sizing_enabled
  const values = draft?.values ?? savedValues
  const touched = draft ? draftTouched(savedState, draft) : false
  const hasErrors = ladderHasErrors(values)
  const nextSteps = stepsFromValues(values)
  const canSave =
    touched &&
    !hasErrors &&
    (enabled !== asset.loss_sizing_enabled || !sameLadder(nextSteps, asset.loss_sizes))

  const update = (next: Partial<LossSizingDraft>) => {
    setError(null)
    onDraftChange(asset.asset_id, { enabled, values, ...next })
  }

  const reset = () => {
    setError(null)
    onDraftChange(asset.asset_id, null)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const updated = await saveAssetLossSizing(asset.asset_id, {
        loss_sizing_enabled: enabled,
        loss_sizes: nextSteps,
      })
      setConfirming(false)
      onSaved(updated)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the loss-streak sizes.'))
      setConfirming(false)
    } finally {
      setSaving(false)
    }
  }

  const symbol = displaySymbol(asset.ticker)
  const changes = describeLadderChanges(savedState, { enabled, steps: nextSteps })
  const outcome = !enabled
    ? 'While it is off every entry uses the normal size; your steps are kept.'
    : nextSteps.length === 0
      ? 'There are no steps yet, so every entry still uses the normal size.'
      : `New ladder: ${ladderSummaryText(asset.base_size, nextSteps)}. Applies from the next entry; exits are never affected.`
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
          aria-label={`Loss-streak sizing for ${symbol}`}
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

      <LossSizingFields
        ticker={asset.ticker}
        base={asset.base_size}
        values={values}
        onChange={(next) => update({ values: next })}
        baseNote="Base size, edited on the Assets tab"
        muted={!enabled}
      />

      <RightNow entry={streaks} enabled={asset.loss_sizing_enabled} />

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
          {hasErrors ? 'Fix the sizes marked in red' : touched ? 'Unsaved changes' : 'No changes'}
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
