/** Shared token-mapped class strings for the Bot Engine cards. */

export const CARD = 'rounded-card border border-border bg-surface p-card'

export const HEAD = 'flex flex-wrap items-center justify-between gap-3 mb-4'
export const HEAD_L = 'flex items-start gap-2.5'
export const ICON_CHIP =
  'w-7 h-7 flex-none grid place-items-center rounded-[9px] bg-accent-soft border border-accent-line text-accent'
export const CARD_TITLE = 'font-display text-[15px] font-extrabold'
export const CARD_SUB = 'text-[12px] text-muted mt-px'

/** Filter chip convention (see AnalyticsFilterPanel). */
export const CHIP_BASE =
  'inline-flex items-center gap-1.5 text-[12px] font-bold py-[7px] px-3 rounded-pill border font-body cursor-pointer'
export const CHIP_ON = 'bg-accent border-accent text-on-accent'
export const CHIP_OFF =
  'border-border bg-surface2 text-muted hover:border-accent-line hover:text-text'

/** Dashed empty/unavailable placeholder inside a card. */
export const NOTE_EMPTY =
  'py-[26px] px-4 border border-dashed border-border rounded-row bg-surface2 text-center text-[13px] text-muted'

/** Amber-ish (accent token) warning banner — rate limits, backend notes. */
export const NOTE_WARN =
  'flex items-start gap-2 rounded-row border border-accent-line bg-accent-soft px-3.5 py-2.5 text-[12.5px] font-semibold text-accent'

/** Red error note (color-mix on the red token, like StatusBadge). */
export const NOTE_ERROR =
  'flex items-start gap-2 rounded-row border border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)] px-3.5 py-2.5 text-[12.5px] font-semibold text-red'
