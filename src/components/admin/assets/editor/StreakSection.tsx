import { useId } from 'react'
import { ChevronDown, TrendingUpDown } from 'lucide-react'
import KillSwitchField from '../KillSwitchField'
import StreakSizingFields from '../StreakSizingFields'
import { FIELD_ERROR } from './editorClasses'
import { draftBase, isBinanceDraft, type AssetDraft } from '../../../../lib/assetDraft'
import { isKilled, killDraftValue } from '../../../../lib/killSwitch'
import { ladderShortText, stepsFromRows } from '../../../../lib/streakSizing'
import type { AdminAsset } from '../../../../types/admin'

interface StreakSectionProps {
  draft: AssetDraft
  update: (patch: Partial<AssetDraft>) => void
  asset: AdminAsset | null
  open: boolean
  onToggle: () => void
  /** The section's problem from the last save attempt, if any. */
  error: string | null
  saving: boolean
}

/** One line under the header: what streak sizing and the kill switch do to this coin right now. */
function summary(draft: AssetDraft, asset: AdminAsset | null): string {
  const steps = stepsFromRows(draft.streakRows)
  const parts = [
    !draft.streakEnabled
      ? 'Streak sizing off: every entry uses the base size'
      : steps.length === 0
        ? 'Streak sizing on, no steps yet'
        : `Streak sizing on · ${ladderShortText(steps)}`,
  ]
  const kill = killDraftValue(draft.kill)
  if (asset && isKilled(asset)) parts.push('stopped by the kill switch')
  else if (typeof kill === 'number') parts.push(`kill switch after ${kill} ${kill === 1 ? 'loss' : 'losses'}`)
  else if (draft.kill.on) parts.push('kill switch on')
  return parts.join(' · ')
}

/**
 * Section 4 — streak sizing and the kill switch. Folded by default on a coin
 * that uses neither (the page opens it when it holds a problem): most coins
 * never touch it, and its ladder is the longest part of the form.
 */
export default function StreakSection({ draft, update, asset, open, onToggle, error, saving }: StreakSectionProps) {
  const bodyId = useId()
  const steps = stepsFromRows(draft.streakRows)
  const largest = steps.reduce((m, s) => Math.max(m, Number(s.size) || 0), 0)
  const base = draftBase(draft)

  return (
    <section id="asset-streak" className="scroll-mt-6 rounded-card border border-border bg-surface">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full cursor-pointer items-start gap-3 rounded-card p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:p-5"
      >
        <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-btn border border-accent-line bg-accent-soft text-accent">
          <TrendingUpDown size={17} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[16px] font-extrabold leading-tight">
            Streak sizing &amp; kill switch
          </span>
          <span className="mt-1 block text-[12.5px] leading-[1.5] text-muted">{summary(draft, asset)}</span>
        </span>
        <ChevronDown
          size={18}
          className={`mt-2 flex-none text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div id={bodyId} className="flex flex-col gap-4 border-t border-hair p-4 sm:p-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 flex-none cursor-pointer accent-[var(--accent)]"
              checked={draft.streakEnabled}
              onChange={(e) => update({ streakEnabled: e.target.checked })}
            />
            <span>
              <span className="block text-[13.5px] font-semibold">Use streak sizing</span>
              <span className="block text-[12px] leading-[1.5] text-faint">
                After losing (or winning) trades in a row on this coin, the next entry uses the size set for that
                step; otherwise the base size. The max position still caps the stack. Exits are never affected.
              </span>
            </span>
          </label>

          <StreakSizingFields
            base={base}
            rows={draft.streakRows}
            onChange={(streakRows) => update({ streakRows })}
            baseNote="Base size, set under Sizing"
            muted={!draft.streakEnabled}
          />

          {isBinanceDraft(draft) && draft.streakEnabled && largest > base && (
            <p className="text-[12px] leading-[1.5] text-faint">
              A streak step can make an entry as big as {largest}. The Binance check beside the form uses the base
              size, so a streak entry ties up more margin than it shows.
            </p>
          )}

          <KillSwitchField
            value={draft.kill}
            onChange={(kill) => update({ kill })}
            disabled={saving}
            symbol={draft.ticker.trim() || undefined}
          />

          {error && (
            <p className={FIELD_ERROR} role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
