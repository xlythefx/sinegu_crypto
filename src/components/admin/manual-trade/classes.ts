/* Token-mapped class strings shared by the manual-trade console
   (same vocabulary as AdminSandbox / SandboxInvoiceCard). */

export const CARD = 'rounded-card border border-border bg-surface p-card'
export const CHIP =
  'w-7 h-7 flex-none grid place-items-center rounded-[9px] bg-accent-soft border border-accent-line text-accent'
export const CARD_HEAD = 'flex items-start gap-3 mb-[18px]'
export const CARD_TITLE = 'font-display text-[15px] font-extrabold'
export const CARD_SUB = 'text-[12px] text-muted mt-px'

export const STEP =
  'inline-grid place-items-center w-[22px] h-[22px] flex-none rounded-[7px] bg-surface2 border border-border font-mono text-[11px] font-bold text-muted'

export const MSG =
  'flex items-start gap-2 rounded-[10px] border py-2.5 px-[13px] text-[12.5px] leading-[1.5]'
export const MSG_OK =
  'border-[color-mix(in_srgb,var(--green)_35%,transparent)] bg-[color-mix(in_srgb,var(--green)_8%,transparent)] text-green'
export const MSG_ERR =
  'border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] text-red'
export const MSG_WARN =
  'border-[color-mix(in_srgb,var(--yellow,#f0b90b)_35%,transparent)] bg-[color-mix(in_srgb,var(--yellow,#f0b90b)_8%,transparent)] text-[var(--yellow,#f0b90b)]'

export const BTN =
  'inline-flex items-center justify-center gap-[7px] h-10 rounded-pill border border-transparent px-[18px] text-[13px] font-bold cursor-pointer transition-[filter,border-color,background,opacity] duration-150 disabled:opacity-[0.55] disabled:cursor-not-allowed'
export const BTN_PRIMARY =
  'bg-accent border-transparent text-on-accent enabled:hover:brightness-[1.06]'
export const BTN_GHOST = 'bg-surface2 border-border text-text enabled:hover:border-accent'
export const BTN_SM = 'h-8 px-3 text-[12px]'

export const INPUT =
  'h-10 w-full rounded-[10px] border border-border bg-surface2 text-text px-3 text-[13px] font-body outline-none transition-[border-color] duration-150 focus:border-accent'
export const LABEL = 'block text-[12px] font-bold text-muted mb-1.5'

/** Segmented option button (action picker, recipient mode, environment). */
export const SEG =
  'rounded-[10px] border-2 px-4 py-2.5 text-[13px] font-bold cursor-pointer transition-[border-color,background,color,transform] duration-150 active:scale-[0.97]'
export const SEG_ON = 'border-accent bg-accent text-on-accent'
export const SEG_OFF =
  'border-border bg-surface2 text-muted hover:border-accent-line hover:text-text'
