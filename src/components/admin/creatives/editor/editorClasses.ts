/**
 * Shared class strings for the video editor (Admin → Creatives → editor),
 * on the design tokens like the rest of Creatives (creativeClasses.ts).
 */

/** A pane of the editor (preview, inspector, timeline). */
export const PANE = 'flex min-w-0 flex-col gap-4 rounded-card border border-border bg-surface p-3.5 sm:p-4'

/** A small heading inside a pane. */
export const PANE_TITLE = 'font-display text-[14.5px] font-extrabold tracking-[-0.01em] text-text'

/** A row inside an inspector list. */
export const ROW = 'flex min-w-0 flex-col gap-2.5 rounded-row border border-hair bg-surface2/60 p-3'

/** A square 36px icon button (ICON_SQ_SM: 30px, for dense rows). */
export const ICON_SQ =
  'inline-flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-btn border border-border bg-surface text-muted transition-[border-color,background,color] duration-150 hover:border-accent-line hover:bg-accent-soft hover:text-accent disabled:cursor-not-allowed disabled:opacity-40'

/** The timeline's lane label column (its width is TIMELINE_LABEL_W). */
export const LANE_LABEL =
  'sticky left-0 z-10 flex w-[60px] flex-none items-center bg-surface pr-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.07em] text-faint'

/** Pixels of the lane label column, for the timeline's arithmetic. */
export const TIMELINE_LABEL_W = 60

/** A range input on the tokens. */
export const RANGE = 'h-2 w-full min-w-0 cursor-pointer accent-[var(--accent)]'

/** Number inputs for seconds. */
export const NUM =
  'h-9 w-full min-w-0 rounded-field border border-border bg-surface2 px-2.5 font-mono text-[12.5px] text-text outline-none focus:border-accent-line'

export const ICON_SQ_SM =
  'inline-flex h-[30px] w-[30px] flex-none cursor-pointer items-center justify-center rounded-[8px] border border-border bg-surface text-muted transition-[border-color,background,color] duration-150 hover:border-accent-line hover:bg-accent-soft hover:text-accent disabled:cursor-not-allowed disabled:opacity-40'

/** A compact pane of the fitted desktop editor. */
export const PANE_TIGHT = 'flex min-w-0 flex-col gap-2.5 rounded-card border border-border bg-surface p-2.5'
