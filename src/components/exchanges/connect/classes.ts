/* Token-mapped class strings shared by the connect-exchange wizard steps
   (same vocabulary as ExchangeAccountCard / KeyBlockedModal). Kept in one
   file so a step never invents its own field height or pill padding. */

/** Panel every step body sits in. */
export const CARD =
  'rounded-card border border-border bg-surface p-6 max-[560px]:p-4'

/** Uppercase mono caption above a field or summary row. */
export const LABEL =
  'font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-faint'

/** Credential / name text input. */
export const INPUT =
  'h-[44px] w-full rounded-nav border border-border bg-surface2 px-3.5 text-[13.5px] text-text outline-none transition-colors duration-150 placeholder:text-faint focus:border-accent-line'

/** Primary rounded pill (Continue / Connect). */
export const PRIMARY_BTN =
  'inline-flex items-center justify-center gap-1.5 rounded-pill border-0 bg-accent px-[22px] py-3 text-[13.5px] font-bold text-on-accent shadow-[0_10px_24px_var(--glow)] transition-[filter,transform] duration-150 hover:brightness-[1.06] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none'

/** Secondary rounded pill (Back / Cancel). */
export const GHOST_BTN =
  'inline-flex items-center justify-center gap-1.5 rounded-pill border border-border bg-surface2 px-[18px] py-3 text-[13.5px] font-semibold text-text transition-colors duration-150 hover:border-accent-line disabled:cursor-not-allowed disabled:opacity-60'

/** Selectable row/card in the exchange and mode steps. */
export const OPTION =
  'flex w-full items-start gap-3.5 rounded-rail border bg-surface2 p-4 text-left transition-[border-color,background,transform] duration-150'

/** Small status pill on an option (Coming soon / Connected / Selected). */
export const OPTION_PILL =
  'inline-flex flex-none items-center gap-[5px] whitespace-nowrap rounded-pill border px-2.5 py-1 text-[10.5px] font-bold'

/** Inline error strip. */
export const ERROR_STRIP =
  'rounded-field border border-[color-mix(in_srgb,var(--red)_30%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] px-3.5 py-2.5 text-[12.5px] leading-[1.5] text-red'

/** Footer holding the Back / Continue pair — stacks on narrow screens. */
export const STEP_FOOTER =
  'mt-6 flex flex-col-reverse gap-2.5 border-t border-hair pt-5 sm:flex-row sm:items-center sm:justify-between'
