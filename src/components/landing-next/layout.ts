/**
 * Shared class strings for the home page (`pages/Landing`, redesigned 2026-11-25).
 *
 * The rhythm is deliberately NOT one centred heading + one card grid per
 * section — that sameness is what made the old page read as a template.
 * Headings sit left, sections alternate their layout, and only the money
 * figures get cards.
 */
export const CONTAINER = 'max-w-[1200px] mx-auto px-10 max-[560px]:px-5'

export const H2 =
  'font-display text-[34px] leading-[1.12] font-bold tracking-[-0.02em] text-text max-[560px]:text-[27px]'

export const LEAD = 'text-[16.5px] leading-[1.65] text-muted max-w-[58ch]'

/** Gold with fixed near-black text: white on this gold fails contrast. */
export const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 min-h-11 text-[15px] font-bold bg-accent text-[#0a0c11] border border-accent rounded-btn py-3 px-5 cursor-pointer transition-[filter] duration-200 hover:brightness-110 shadow-[3px_3px_0_0_var(--accentLine)]'

export const BTN_SECONDARY =
  'inline-flex items-center justify-center gap-2 min-h-11 text-[15px] font-semibold bg-surface text-text border border-border rounded-btn py-3 px-5 cursor-pointer transition-colors duration-200 hover:border-accent-line'

/** Section ids the page scrolls to. */
export const LANDING_IDS = {
  latestTrades: 'latest-trades',
  record: 'record',
} as const
