/* Shared Tailwind class-strings for the app shell (trader + admin sidebars,
   top bars). These were the .dsh/.dsb/.dtb/.theme-toggle rules in the old
   DashboardLayout.css; migrated 1:1 to utilities mapped to our design tokens.

   Rail behavior: the aside is `group/rail` — it expands 76px→246px on hover
   (desktop) and its labels fade in via `group-hover/rail:`. On mobile
   (max-900) it becomes a fixed off-canvas drawer that slides in when the
   shell root (`group/shell`) carries the `drawer-open` marker class. */

// ---- shell ----
export const SHELL =
  'group/shell flex items-stretch min-h-screen w-full bg-bg text-text transition-[background,color] duration-[400ms]'
export const SHELL_MAIN = 'flex-1 min-w-0 py-[22px] px-6'
export const SHELL_BACKDROP = 'fixed inset-0 bg-black/50 z-[60]'

// ---- sidebar rail ----
export const RAIL =
  'group/rail w-[76px] flex-none self-stretch bg-surface border-r border-hair overflow-x-hidden overflow-y-auto flex flex-col sticky top-0 h-screen z-20 transition-[width] duration-[220ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:w-[246px] ' +
  'max-[900px]:fixed max-[900px]:left-0 max-[900px]:top-0 max-[900px]:w-[246px] max-[900px]:h-screen max-[900px]:-translate-x-full max-[900px]:transition-transform max-[900px]:duration-[280ms] max-[900px]:z-[70] max-[900px]:group-[.drawer-open]/shell:translate-x-0'

export const BRAND =
  'flex items-center gap-3 h-[74px] pl-[22px] border-b border-hair flex-none no-underline'
export const BRAND_LOGO = 'w-[30px] h-[30px] flex-none object-contain scale-[1.6]'
// labels/brand text: hidden on the collapsed rail, revealed on hover / always on mobile
export const REVEAL =
  'opacity-0 transition-opacity duration-[180ms] whitespace-nowrap group-hover/rail:opacity-100 max-[900px]:opacity-100'
export const BRAND_TEXT = `flex flex-col ${REVEAL}`
export const BRAND_TITLE = 'font-display text-accent text-[16px] font-extrabold'
export const BRAND_SUB = 'text-faint text-[10.5px] font-semibold'

export const NAV = 'flex flex-col gap-1 py-3 px-[13px] flex-1'
export const ITEM_BASE =
  'flex items-center gap-3.5 h-[42px] pl-[13px] rounded-nav no-underline font-semibold text-[13.5px] whitespace-nowrap transition-[background,color] duration-150'
export const ITEM_OFF = 'text-muted hover:bg-surface2 hover:text-text'
export const ITEM_ON =
  'bg-accent-soft text-accent font-bold shadow-[inset_3px_0_0_var(--accent)]'
export const ITEM_ICON = 'w-5 flex-none flex items-center'

export const FOOTER =
  'border-t border-hair p-[13px] flex-none flex flex-col gap-2'
export const ADMIN_SWITCH =
  'flex items-center gap-3.5 w-full h-10 pl-[13px] rounded-nav bg-accent-soft border border-accent-line text-accent font-bold text-[13px] cursor-pointer whitespace-nowrap hover:bg-surface2 hover:border-accent'
export const LOGOUT =
  'flex items-center gap-3.5 w-full h-10 pl-[13px] rounded-nav bg-transparent border border-border text-red font-bold text-[13px] cursor-pointer whitespace-nowrap hover:bg-[rgba(255,90,90,0.08)] hover:border-[rgba(255,90,90,0.4)]'

// ---- top bar ----
export const TOPBAR = 'flex items-center justify-between mb-[18px] gap-3 flex-wrap'
export const BURGER =
  'hidden w-[38px] h-[38px] rounded-nav border border-border bg-surface text-accent items-center justify-center cursor-pointer flex-none p-0 max-[900px]:flex'
export const TOPBAR_RIGHT = 'flex items-center gap-3 flex-wrap ml-auto'
export const FILTER = 'flex gap-1 bg-surface2 border border-hair rounded-pill p-1'
export const FILTER_PILL_BASE =
  'flex items-center gap-[7px] border bg-transparent text-[12.5px] font-semibold py-1.5 px-3 rounded-pill cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
export const FILTER_PILL_OFF = 'border-transparent text-muted'
export const FILTER_PILL_ON = 'bg-surface border-border text-text font-bold'
export const FILTER_DOT = 'w-[7px] h-[7px] rounded-full'

// theme toggle (was .theme-toggle / __icon in Landing.css)
export const THEME_TOGGLE =
  'flex items-center gap-2 font-mono text-[12px] bg-surface text-text border border-border py-[9px] px-3.5 rounded-pill cursor-pointer'
export const THEME_TOGGLE_ICON = 'text-[14px]'
