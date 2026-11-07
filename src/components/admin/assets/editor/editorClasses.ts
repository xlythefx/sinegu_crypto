/**
 * Class strings shared by the create / edit asset page (Admin → Trading Assets
 * → New / Edit). Mapped to the design tokens in index.css. Controls are 44px
 * tall: they are tapped on a phone as often as clicked.
 */

export const FIELD = 'flex min-w-0 flex-col gap-1.5'
export const FIELD_LABEL = 'text-[12.5px] font-semibold text-text'
export const FIELD_HINT = 'text-[11.5px] leading-[1.5] text-faint'
export const FIELD_NOTE = 'font-mono text-[11.5px] leading-[1.5] text-muted'
export const FIELD_ERROR = 'text-[12px] font-semibold leading-[1.5] text-red'

export const CONTROL =
  'h-11 w-full min-w-0 rounded-field border border-border bg-surface2 px-3.5 text-[14px] text-text outline-none font-body transition-[border-color,box-shadow] duration-150 placeholder:text-faint focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_25%,transparent)] aria-[invalid=true]:border-red'
export const NUMBER_CONTROL = `${CONTROL} font-mono`
export const SELECT = `${CONTROL} cursor-pointer [&>option]:bg-surface [&>option]:text-text`

export const BTN =
  'inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-pill px-5 text-[13.5px] font-bold font-body transition-[background,border-color,color,opacity] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60'
export const BTN_PRIMARY = `${BTN} bg-accent text-on-accent hover:opacity-90`
export const BTN_SECONDARY = `${BTN} border border-border bg-surface2 text-text hover:border-accent`
export const SMALL_BTN =
  'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-pill border border-border bg-surface2 px-3.5 text-[12.5px] font-semibold text-text transition-[border-color,color] duration-150 hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
