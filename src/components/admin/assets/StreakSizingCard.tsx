import { useMemo, useState } from 'react'
import { Activity } from 'lucide-react'
import AssetLogo from './AssetLogo'
import KilledAssetStrip from './KilledAssetStrip'
import KillSwitchField from './KillSwitchField'
import StreakSizingFields from './StreakSizingFields'
import ConfirmModal from '../../ui/ConfirmModal'
import { EXCHANGE_META, exchangeFromBroker } from '../../exchanges/meta'
import { saveAssetStreakSizing, setAssetEnabled } from '../../../services/admin'
import { getApiErrorMessage } from '../../../services/api'
import { displaySymbol } from '../../../lib/chart'
import {
  isKilled,
  killDraftError,
  killDraftFrom,
  killDraftValue,
  killSwitchOutcome,
  reviveConfirmCopy,
} from '../../../lib/killSwitch'
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
import type { AdminAsset, AssetStreakSize, AssetStreakSizingInput } from '../../../types/admin'

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
  /** The asset changed outside the ladder (turned back on) — keep any unsaved draft. */
  onAssetChanged: (asset: AdminAsset) => void
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
 * sit on it right now, the kill switch, and a confirmed save. Nothing is
 * written until Save → Yes — the switch, the rows and the kill switch are a
 * draft.
 *
 * A coin the kill switch has stopped shows a red strip at the top with
 * "Turn back on" (its own confirmation, and it changes nothing but
 * `enabled`, so an unsaved draft on the card survives it).
 */
export default function StreakSizingCard({
  asset,
  draft,
  onDraftChange,
  streaks,
  onSaved,
  onAssetChanged,
}: StreakSizingCardProps) {
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reviving, setReviving] = useState(false)
  const [reviveBusy, setReviveBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const savedState = useMemo(
    () => ({
      enabled: asset.streak_sizing_enabled,
      steps: asset.streak_sizes,
      killSwitch: asset.kill_switch_losses,
    }),
    [asset.streak_sizing_enabled, asset.streak_sizes, asset.kill_switch_losses],
  )
  // Built once per saved ladder, so the row ids (React keys) stay put until
  // the first edit copies them into the draft.
  const savedRows = useMemo(() => rowsFromSteps(asset.streak_sizes), [asset.streak_sizes])
  const savedKill = useMemo(
    () => killDraftFrom(asset.kill_switch_losses),
    [asset.kill_switch_losses],
  )

  const enabled = draft?.enabled ?? asset.streak_sizing_enabled
  const rows = draft?.rows ?? savedRows
  const kill = draft?.kill ?? savedKill
  const touched = draft ? draftTouched(savedState, draft) : false
  const hasErrors = ladderHasErrors(rows)
  const killError = killDraftError(kill)
  const nextSteps = stepsFromRows(rows)
  const stepsChanged = !sameLadder(nextSteps, asset.streak_sizes)
  const ladderChanged = enabled !== asset.streak_sizing_enabled || stepsChanged
  const nextKill = killDraftValue(kill)
  const killChanged = nextKill !== undefined && nextKill !== asset.kill_switch_losses
  const canSave = touched && !hasErrors && !killError && (ladderChanged || killChanged)

  const update = (next: Partial<StreakSizingDraft>) => {
    setError(null)
    onDraftChange(asset.asset_id, { enabled, rows, kill, ...next })
  }

  const reset = () => {
    setError(null)
    onDraftChange(asset.asset_id, null)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    // The kill switch is sent only when it changes, so saving a ladder never
    // touches a kill switch that is already counting.
    const input: AssetStreakSizingInput = {
      streak_sizing_enabled: enabled,
      streak_sizes: nextSteps,
    }
    if (killChanged) input.kill_switch_losses = nextKill
    try {
      const updated = await saveAssetStreakSizing(asset.asset_id, input)
      setConfirming(false)
      onSaved(updated)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save the streak sizes.'))
      setConfirming(false)
    } finally {
      setSaving(false)
    }
  }

  const revive = async () => {
    setReviveBusy(true)
    setError(null)
    try {
      const updated = await setAssetEnabled(asset, true)
      setReviving(false)
      onAssetChanged(updated)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not turn the coin back on.'))
      setReviving(false)
    } finally {
      setReviveBusy(false)
    }
  }

  const symbol = displaySymbol(asset.ticker)
  const killed = isKilled(asset)
  // The exchange leads, as on the Assets tab: LTC on Binance and LTC on MEXC
  // are two ladders, and only this word and the corner tile tell them apart.
  const exchange = exchangeFromBroker(asset.broker)
  const venue = exchange ? EXCHANGE_META[exchange].label : asset.broker?.trim() || 'No exchange'
  const changes = describeLadderChanges(savedState, {
    enabled,
    steps: nextSteps,
    killSwitch: killChanged ? (nextKill ?? null) : asset.kill_switch_losses,
  })
  // A win step above base fills the max position size sooner — the cap still
  // holds the total, so the admin should know before saving one.
  const winAboveBase = nextSteps.some((s) => s.kind === 'win' && s.size > asset.base_size)
  const ladderOutcome = !enabled
    ? 'While it is off every entry uses the normal size; your steps are kept.'
    : nextSteps.length === 0
      ? 'There are no steps yet, so every entry still uses the normal size.'
      : `New ladder: ${ladderSummaryText(asset.base_size, nextSteps)}. Applies from the next entry; exits are never affected.${
          winAboveBase
            ? ` Win sizes above normal still stop at the max position size (${fmtSize(asset.max_increments)}), so a stack reaches it in fewer entries.`
            : ''
        }`
  const outcomes = [
    ladderChanged ? ladderOutcome : null,
    killChanged ? killSwitchOutcome(asset.kill_switch_losses, nextKill ?? null, symbol) : null,
  ].filter(Boolean)
  const confirmMessage = `${changes.join(' · ')}. ${outcomes.join(' ')}`
  const confirmTitle = ladderChanged
    ? `Save streak sizing for ${symbol} on ${venue}?`
    : `Save the kill switch for ${symbol} on ${venue}?`
  const revivalCopy = reviveConfirmCopy(symbol)

  const meta = [`Base size ${fmtSize(asset.base_size)}`]
  if (!asset.enabled) meta.push(killed ? 'switched off' : 'asset is off')
  const footerNote = hasErrors
    ? 'Fix the steps marked in red'
    : killError
      ? 'Fix the kill switch count'
      : touched
        ? 'Unsaved changes'
        : 'No changes'

  return (
    <article
      className={`flex flex-col gap-4 rounded-card border bg-surface p-4 transition-[border-color] duration-150 sm:p-5 ${
        touched ? 'border-accent-line' : 'border-border'
      }`}
    >
      {/* First on the card: nobody trades this coin until it is turned back on. */}
      {killed && (
        <KilledAssetStrip
          asset={asset}
          onTurnBackOn={() => setReviving(true)}
          busy={reviveBusy || saving}
        />
      )}

      <header className="flex items-center gap-3">
        <AssetLogo ticker={asset.ticker} image={asset.asset_image} exchange={exchange} />

        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[15px] font-extrabold tracking-[-0.01em]">
            {symbol}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-muted">
            <span className={exchange ? 'font-semibold text-text' : ''}>{venue}</span>
            {' · '}
            {meta.join(' · ')}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`Streak sizing for ${symbol} on ${venue}`}
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
        unsaved={ladderChanged}
      />

      <KillSwitchField
        value={kill}
        onChange={(next) => update({ kill: next })}
        disabled={saving}
        symbol={symbol}
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
            hasErrors || killError ? 'text-red' : touched ? 'text-accent' : 'text-faint'
          }`}
        >
          {footerNote}
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
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={saving ? 'Saving…' : 'Yes, save'}
        cancelLabel="No"
        onConfirm={() => !saving && save()}
        onCancel={() => !saving && setConfirming(false)}
      />

      <ConfirmModal
        open={reviving}
        title={revivalCopy.title}
        message={revivalCopy.message}
        confirmLabel={reviveBusy ? 'Turning on…' : revivalCopy.confirmLabel}
        cancelLabel="No"
        onConfirm={() => !reviveBusy && revive()}
        onCancel={() => !reviveBusy && setReviving(false)}
      />
    </article>
  )
}
