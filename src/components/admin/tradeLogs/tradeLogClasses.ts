import type { BadgeTone } from '../../../lib/signalHealth'
import type { ReasonSeverity } from '../../../types/tradeLogs'

/** Class strings shared across Admin → Signal Log's components. */

export const CHIP_BASE =
  'border rounded-pill py-[7px] px-3.5 text-[12px] font-semibold cursor-pointer transition-[border-color,color] duration-150'
export const CHIP_OFF =
  'border-border bg-surface2 text-muted hover:text-text hover:border-accent'
export const CHIP_ON = 'bg-accent border-accent text-on-accent'

export const SELECT =
  'h-[38px] max-w-full min-w-0 border border-border rounded-[12px] bg-surface2 text-text px-3 text-[12.5px] font-body cursor-pointer'

/** Small uppercase label in front of a chip row. */
export const ROW_LABEL =
  'text-[10.5px] uppercase tracking-[0.07em] text-faint font-semibold mr-1'

/** Uppercase status pill (filled / skipped / failed). */
export const PILL =
  'text-[10px] font-bold uppercase tracking-[0.05em] py-[3px] px-[9px] rounded-pill whitespace-nowrap'

const CHIP_SHAPE = 'inline-flex items-center gap-1 text-[11.5px] px-2 py-[2px] rounded-pill border'

/** Count chip on a collapsed signal row ("7 filled", "2 problems"). */
export const COUNT_CHIP = `${CHIP_SHAPE} whitespace-nowrap font-mono`

/** Word chip on the same row ("Master", "Rejected: …") — body font, may wrap. */
export const LABEL_CHIP = `${CHIP_SHAPE} font-semibold leading-[1.4]`

const GREEN_TINT =
  'border-[color-mix(in_srgb,var(--green)_35%,transparent)] bg-[color-mix(in_srgb,var(--green)_10%,transparent)] text-green'
const RED_TINT =
  'border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)] text-red'
const NEUTRAL_TINT = 'border-hair bg-surface2 text-muted'

export const TONE: Record<BadgeTone, string> = {
  good: GREEN_TINT,
  bad: RED_TINT,
  neutral: NEUTRAL_TINT,
}

/** Reason badge, coloured by the API's verdict: grey normal, red problem. */
export const SEVERITY_TONE: Record<ReasonSeverity, string> = {
  normal: NEUTRAL_TINT,
  problem: RED_TINT,
}

export const REASON_BADGE =
  'inline-flex items-center rounded-pill border px-2.5 py-[3px] text-[11.5px] font-semibold leading-[1.35]'

/** "Fix in API Keys →" — a small secondary button. */
export const FIX_BTN =
  'inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-btn border border-border bg-surface2 px-3 py-[6px] text-[12px] font-semibold text-text transition-colors duration-150 hover:border-accent hover:text-accent'

/** The section card every view sits in. */
export const SECTION = 'rounded-card border border-border bg-surface p-[18px] max-[480px]:p-3.5'
