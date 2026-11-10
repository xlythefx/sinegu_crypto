/**
 * Shared Tailwind class strings for Admin → Creatives, mapped to the design
 * tokens so both themes work. Tone NAMES come from lib/creatives.ts; this is
 * the one place they become colours.
 */

import type { CreativeTone } from '../../../lib/creatives'

/** A section card on this page (same chrome as Admin → AI Access). */
export const SECTION = 'flex min-w-0 flex-col gap-4 rounded-card border border-border bg-surface p-card max-[480px]:p-3.5'

export const SECTION_ICON =
  'grid h-9 w-9 flex-none place-items-center rounded-[10px] border border-accent-line bg-accent-soft text-accent'
export const SECTION_TITLE = 'font-display text-[16px] font-extrabold text-text'
export const SECTION_SUB = 'mt-0.5 text-[12.5px] leading-[1.55] text-muted'

/** Small mono caption over a fact ("COST", "MADE BY"). */
export const FACT_LABEL = 'font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-faint'
export const FACT_VALUE = 'mt-0.5 text-[12.5px] text-text'

export const TEXTAREA =
  'w-full min-h-[88px] resize-y rounded-field border border-border bg-surface2 px-3 py-2.5 font-body text-[13px] leading-[1.55] text-text outline-none transition-[border-color,background] duration-150 placeholder:text-faint focus:border-accent-line focus:bg-surface disabled:cursor-not-allowed disabled:opacity-60'

/** Comfortable 36px+ secondary action, for card footers on a phone. */
export const BTN_SOFT =
  'inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-field border border-border bg-surface px-3 text-[12px] font-bold text-text transition-[border-color,background,color] duration-150 hover:border-accent-line hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50'
export const BTN_SOFT_DANGER =
  'inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-field border border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-transparent px-3 text-[12px] font-bold text-red transition-[background] duration-150 hover:bg-[color-mix(in_srgb,var(--red)_10%,transparent)] disabled:cursor-not-allowed disabled:opacity-50'
/** Primary action as a link (Download) — same look as BTN_PRIMARY_SM, 36px tall. */
export const LINK_PRIMARY =
  'inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-field border border-transparent bg-accent px-3 text-[12px] font-bold text-on-accent shadow-[0_8px_20px_var(--glow)] transition-[filter] duration-150 hover:brightness-[1.06]'

/** Pill colours per tone. */
export const TONE_PILL: Record<CreativeTone, string> = {
  muted: 'border-border bg-surface2 text-muted',
  teal: 'border-[color-mix(in_srgb,var(--teal)_38%,transparent)] bg-[color-mix(in_srgb,var(--teal)_10%,transparent)] text-teal',
  accent: 'border-accent-line bg-accent-soft text-accent',
  silver:
    'border-[color-mix(in_srgb,var(--silver)_38%,transparent)] bg-[color-mix(in_srgb,var(--silver)_10%,transparent)] text-silver',
  green:
    'border-[color-mix(in_srgb,var(--green)_35%,transparent)] bg-[color-mix(in_srgb,var(--green)_10%,transparent)] text-green',
  red: 'border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)] text-red',
}

/** A dot in the tone's colour (board column headers). */
export const TONE_DOT: Record<CreativeTone, string> = {
  muted: 'bg-muted',
  teal: 'bg-teal',
  accent: 'bg-accent',
  silver: 'bg-silver',
  green: 'bg-green',
  red: 'bg-red',
}

export const PILL_BASE =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-pill border px-2 py-[2px] text-[11px] font-semibold leading-[1.45]'

/** Notice strips (error / success / info) — the Settings notice look, without its margins. */
export const NOTICE_BASE =
  'flex items-start gap-2 rounded-field border px-3 py-2.5 text-[12.5px] font-semibold leading-[1.5] [&>svg]:mt-px [&>svg]:flex-none'
export const NOTICE = {
  error: `${NOTICE_BASE} border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] text-red`,
  success: `${NOTICE_BASE} border-[color-mix(in_srgb,var(--green)_35%,transparent)] bg-[color-mix(in_srgb,var(--green)_8%,transparent)] text-green`,
  info: `${NOTICE_BASE} border-accent-line bg-accent-soft text-accent`,
} as const
