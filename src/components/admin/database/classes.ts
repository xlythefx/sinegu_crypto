/** Shared token-mapped class strings for the Database console. */

export const CARD = 'rounded-card border border-border bg-surface p-card'

export const HEAD = 'flex flex-wrap items-center justify-between gap-3 mb-4'
export const HEAD_L = 'flex items-start gap-2.5'
export const ICON_CHIP =
  'w-7 h-7 flex-none grid place-items-center rounded-[9px] bg-accent-soft border border-accent-line text-accent'
export const CARD_TITLE = 'font-display text-[15px] font-extrabold'
export const CARD_SUB = 'text-[12px] text-muted mt-px'

export const CHIP_BASE =
  'inline-flex items-center gap-1.5 text-[12px] font-bold py-[7px] px-3 rounded-pill border font-body cursor-pointer'
export const CHIP_ON = 'bg-accent border-accent text-on-accent'
export const CHIP_OFF =
  'border-border bg-surface2 text-muted hover:border-accent-line hover:text-text'

export const NOTE_EMPTY =
  'py-[26px] px-4 border border-dashed border-border rounded-row bg-surface2 text-center text-[13px] text-muted'
export const NOTE_WARN =
  'flex items-start gap-2 rounded-row border border-accent-line bg-accent-soft px-3.5 py-2.5 text-[12.5px] font-semibold text-accent'
export const NOTE_ERROR =
  'flex items-start gap-2 rounded-row border border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)] px-3.5 py-2.5 text-[12.5px] font-semibold text-red'
export const NOTE_OK =
  'flex items-start gap-2 rounded-row border border-[color-mix(in_srgb,var(--green)_35%,transparent)] bg-[color-mix(in_srgb,var(--green)_10%,transparent)] px-3.5 py-2.5 text-[12.5px] font-semibold text-green'

/* ---- data grid ---- */

export const TH =
  'text-left text-[10.5px] uppercase tracking-[0.07em] text-faint font-semibold py-0 px-3.5 pb-2.5 border-b border-border whitespace-nowrap'
export const TD =
  'py-3 px-3.5 border-b border-hair text-[13px] text-text align-middle'
export const TD_MONO = `${TD} font-mono text-[12px]`
export const TH_BTN =
  'inline-flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0 font-semibold uppercase tracking-[0.07em] text-[10.5px] text-faint hover:text-text'

export const PAG_BTN =
  'grid place-items-center w-8 h-8 border border-border bg-surface2 text-text rounded-[9px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

export const ICON_BTN =
  'grid place-items-center w-7 h-7 rounded-[8px] border border-border bg-surface2 text-muted cursor-pointer hover:text-text hover:border-accent-line disabled:opacity-40 disabled:cursor-not-allowed'
export const ICON_BTN_DANGER =
  'grid place-items-center w-7 h-7 rounded-[8px] border border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] text-red cursor-pointer hover:bg-[color-mix(in_srgb,var(--red)_16%,transparent)] disabled:opacity-40 disabled:cursor-not-allowed'

/* ---- form controls ---- */

export const INPUT =
  'w-full bg-surface2 border border-border rounded-field py-2 px-3 text-[13px] text-text placeholder:text-faint focus:outline-none focus:border-accent-line disabled:opacity-55 disabled:cursor-not-allowed'
export const LABEL =
  'block text-[11px] uppercase tracking-[0.06em] text-faint font-semibold mb-1.5'

export const BTN =
  'inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface2 text-text py-1.5 px-3.5 text-[12px] font-bold cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed'
export const BTN_ACCENT =
  'inline-flex items-center gap-1.5 rounded-pill border-0 bg-accent text-on-accent py-1.5 px-3.5 text-[12px] font-bold cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed'
export const BTN_DANGER =
  'inline-flex items-center gap-1.5 rounded-pill border-0 bg-red text-white py-1.5 px-3.5 text-[12px] font-bold cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed'

/** Monospace scroll pane — SQL input and long-value previews. */
export const MONO_PANE =
  'bg-surface2 border border-hair rounded-[10px] font-mono text-[12px] leading-[1.65] overflow-auto p-3.5 whitespace-pre-wrap break-words'
