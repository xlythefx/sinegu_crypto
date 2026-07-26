/**
 * Shared Tailwind class-strings for the Settings page.
 *
 * These are the primitives that were previously the `.set-*`, `.sfield`,
 * `.sinput`, `.sbtn`, `.sicon-btn`, `.snotice`, `.sbadge` and `.dcard` classes
 * in Settings.css. Migrated 1:1 to Tailwind utilities (mapped to our design
 * tokens) so every settings component reaches for the same strings instead of
 * repeating long utility lists. Import what you need per component.
 */

/* ---------- card chrome (was .dcard / .dchip / .dcard__title-row) ---------- */
export const CARD = 'rounded-card border border-border bg-surface p-card'
/** High-water-mark accent card — gradient fill + accent border. */
export const CARD_HWM =
  'rounded-card border border-accent-line p-card bg-[linear-gradient(160deg,var(--accentSoft),var(--surface))]'
/** Card header row: chip + titles + trailing action, top-aligned. */
export const CARD_HEAD = 'flex items-start gap-2.5 mb-3.5'
export const CARD_TITLES = 'flex-1 min-w-0'
export const CARD_TITLE = 'font-display text-[15px] font-extrabold'
export const CARD_SUB = 'text-[12px] text-muted mt-px'
export const CHIP =
  'w-7 h-7 rounded-[9px] bg-accent-soft border border-accent-line grid place-items-center text-accent flex-none'

/* ---------- form layout ---------- */
export const FIELDS = 'flex flex-1 flex-col gap-4'
export const FORM = 'flex flex-col gap-3.5'
export const FORM_ACTIONS = 'flex justify-end gap-2 pt-3 border-t border-hair'
/** Same as FORM_ACTIONS but with an accent hairline (used inside accent forms). */
export const FORM_ACTIONS_ACCENT =
  'flex justify-end gap-2 pt-3 border-t border-accent-line'
export const VALUE = 'text-[14px] font-bold'
export const VALUE_LG = 'text-[15px] font-bold'
export const LOADING =
  'text-[13px] text-muted py-6 text-center animate-[pulse_1.6s_ease-in-out_infinite]'
export const EMPTY = 'text-[13px] text-muted text-center py-4'

/* ---------- field ---------- */
export const FIELD = 'flex flex-col gap-1.5'
export const LABEL =
  'flex items-center gap-1.5 text-[11px] font-bold tracking-[0.05em] uppercase text-faint [&_svg]:text-accent [&_svg]:flex-none'
export const HINT = 'text-[11px] text-faint'

const INPUT_BASE =
  'w-full h-10 px-3 border border-border rounded-field bg-surface2 text-text outline-none transition-[border-color,background] duration-150 focus:border-accent-line focus:bg-surface disabled:opacity-60 disabled:cursor-not-allowed'
export const INPUT = `${INPUT_BASE} font-body text-[13px]`
export const INPUT_MONO = `${INPUT_BASE} font-mono text-[12.5px]`
export const SELECT = `${INPUT} cursor-pointer [&>option]:bg-surface [&>option]:text-text`

/* ---------- buttons ---------- */
const BTN_BASE =
  'inline-flex items-center justify-center gap-1.5 border rounded-field font-body font-bold cursor-pointer transition-[background,border-color,opacity] duration-150'
const BTN_MD = 'h-[38px] px-4 text-[12.5px]'
const BTN_SM = 'h-8 px-3 text-[12px]'
const V_PRIMARY =
  'border-transparent bg-accent text-on-accent shadow-[0_8px_20px_var(--glow)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none'
const V_GHOST =
  'bg-surface border-border text-text hover:border-accent-line hover:bg-accent-soft'
const V_DANGER =
  'border-transparent bg-red text-white shadow-[0_8px_20px_rgba(255,90,90,0.2)] disabled:opacity-60 disabled:cursor-not-allowed'

export const BTN_PRIMARY = `${BTN_BASE} ${BTN_MD} ${V_PRIMARY}`
export const BTN_PRIMARY_SM = `${BTN_BASE} ${BTN_SM} ${V_PRIMARY}`
export const BTN_GHOST = `${BTN_BASE} ${BTN_MD} ${V_GHOST}`
export const BTN_GHOST_SM = `${BTN_BASE} ${BTN_SM} ${V_GHOST}`
export const BTN_DANGER = `${BTN_BASE} ${BTN_MD} ${V_DANGER}`

/* ---------- icon buttons ---------- */
const ICON_BTN_BASE =
  'inline-flex items-center justify-center w-[30px] h-[30px] rounded-btn bg-transparent text-muted cursor-pointer flex-none transition-[background,color] duration-150'
export const ICON_BTN = `${ICON_BTN_BASE} hover:text-accent hover:bg-accent-soft`
export const ICON_BTN_DANGER = `${ICON_BTN_BASE} hover:text-red hover:bg-[rgba(255,90,90,0.1)]`

/* ---------- inline notices (no toast system) ---------- */
const NOTICE_BASE =
  'flex items-start gap-2 py-2.5 px-3 border rounded-field text-[12.5px] font-semibold leading-[1.45] [&>svg]:flex-none [&>svg]:mt-px'

/** Inline notice classes for a success / error / warn tone. */
export function notice(kind: 'success' | 'error' | 'warn'): string {
  const tone = {
    success:
      'mb-3 text-green border-[rgba(47,214,122,0.35)] bg-[rgba(47,214,122,0.08)]',
    error: 'mb-3 text-red border-[rgba(255,90,90,0.35)] bg-[rgba(255,90,90,0.08)]',
    warn: 'mt-3.5 text-accent border-accent-line bg-accent-soft',
  }[kind]
  return `${NOTICE_BASE} ${tone}`
}

/* ---------- status badge ---------- */
const BADGE_BASE =
  'inline-flex items-center py-[3px] px-2.5 rounded-pill border text-[11.5px] font-bold'

/** Status pill classes; unknown/empty statuses fall back to a muted pill. */
export function badge(status: string): string {
  const tones: Record<string, string> = {
    active:
      'text-green border-[rgba(47,214,122,0.35)] bg-[rgba(47,214,122,0.08)]',
    pending: 'text-accent border-accent-line bg-accent-soft',
    suspended:
      'text-red border-[rgba(255,90,90,0.35)] bg-[rgba(255,90,90,0.08)]',
  }
  return `${BADGE_BASE} ${tones[status] ?? 'border-border text-muted'}`
}
