/**
 * Shared Tailwind class-strings for the auth pages (/auth, /auth/forgot,
 * /auth/discord/*). They were duplicated verbatim between Auth.tsx and
 * ForgotPassword.tsx; a third page made the copy the wrong shape.
 */

export const INPUT =
  'h-12 w-full border border-border rounded-[12px] bg-surface2 px-4 text-[14px] text-text outline-none font-body transition-[border-color,box-shadow] duration-200 focus:border-accent focus:shadow-[0_0_0_3px_var(--glowAuth)]'

export const BUTTON =
  'relative mt-1 h-12 overflow-hidden rounded-[12px] border-0 bg-accent font-body text-[15px] font-bold text-on-accent shadow-[0_10px_24px_var(--glowAuth)] transition-transform duration-200 hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60'

/** Secondary full-width button — same shape as an input, no glow. */
export const BUTTON_GHOST =
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-[12px] border border-border bg-surface2 font-body text-[14px] font-bold text-text transition-[border-color,background] duration-200 hover:border-accent hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60'

export const ERROR =
  'm-0 rounded-[10px] border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] py-2.5 px-3.5 text-[13px] leading-[1.4] text-[#ef4444]'

/** The referral "code applied" pill. */
export const PILL =
  'm-0 self-start inline-flex items-center gap-1.5 rounded-pill border border-accent-line bg-accent-soft py-1.5 px-3 font-mono text-[11.5px] text-accent'

export const CHECKBOX_LABEL =
  'flex cursor-pointer items-start gap-3 text-[13px] leading-[1.55] text-muted'

export const CHECKBOX =
  'mt-[3px] h-4 w-4 shrink-0 cursor-pointer accent-[var(--accent)]'

export const TITLE =
  'mb-1.5 font-display text-[34px] font-extrabold tracking-[-0.02em] max-[760px]:text-[28px]'

export const SUBTITLE = 'mb-6 text-[14px] leading-[1.6] text-muted'

/** The icon chip above a single-column page's title (forgot password, Discord steps). */
export const ICON_CHIP =
  'inline-flex h-11 w-11 items-center justify-center rounded-btn border border-accent-line bg-accent-soft text-accent'

export const LINK = 'font-semibold text-text hover:underline'
