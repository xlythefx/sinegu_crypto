/**
 * Which scenes the editor has picked — PURE (no React, no DOM). The pick is
 * what the editor's chat talks about (`focus_scene_ids`): one clip clicked,
 * several picked with Ctrl/Cmd or Shift, or every clip a drag across the
 * scene track crosses. Nothing picked = the whole video.
 *
 * The rules, as an editor person expects them:
 * - a plain click picks that one scene (and only it);
 * - Ctrl/Cmd + click adds it, or takes it back out;
 * - Shift + click picks the run from the last plain/Ctrl click to it;
 * - a drag picks the scenes it crosses (added to the pick with Ctrl/Cmd/Shift);
 * - Esc or "All scenes" clears it.
 * Ids are always kept in timeline order.
 */

import type { SceneSpan } from './timeline'

export interface SceneSelection {
  /** Picked scenes, in timeline order. */
  ids: number[]
  /** Where a Shift + click range starts (the last plain or Ctrl/Cmd click). */
  anchor: number | null
}

export const NO_SELECTION: SceneSelection = { ids: [], anchor: null }

/** The API takes at most this many focused scenes per message. */
export const MAX_FOCUS = 12

export interface ClickModifiers {
  /** Ctrl (Windows / Linux) or Cmd (Mac). */
  toggle?: boolean
  /** Shift. */
  range?: boolean
}

/** Only ids still on the timeline, in its order, each once. */
export function inOrder(ids: Iterable<number>, order: readonly number[]): number[] {
  const want = new Set(ids)
  return order.filter((id) => want.has(id))
}

/** A click on a scene (timeline block or scene list row). `order` = every scene id in timeline order. */
export function clickSelect(
  sel: SceneSelection,
  order: readonly number[],
  id: number,
  mods: ClickModifiers = {},
): SceneSelection {
  if (!order.includes(id)) return sel
  if (mods.range) {
    const anchor = sel.anchor !== null && order.includes(sel.anchor) ? sel.anchor : id
    const a = order.indexOf(anchor)
    const b = order.indexOf(id)
    const run = order.slice(Math.min(a, b), Math.max(a, b) + 1)
    // Ctrl/Cmd + Shift adds the run to what was picked; Shift alone replaces it.
    return { ids: inOrder(mods.toggle ? [...sel.ids, ...run] : run, order), anchor }
  }
  if (mods.toggle) {
    const has = sel.ids.includes(id)
    return { ids: inOrder(has ? sel.ids.filter((x) => x !== id) : [...sel.ids, id], order), anchor: id }
  }
  return { ids: [id], anchor: id }
}

/**
 * The scenes a drag from `fromMs` to `toMs` (either direction) crosses on
 * the video's clock. Touching an edge is not crossing: a scene must overlap
 * the dragged stretch by more than a moment.
 */
export function scenesCrossed(spans: readonly SceneSpan[], fromMs: number, toMs: number): number[] {
  const lo = Math.min(fromMs, toMs)
  const hi = Math.max(fromMs, toMs)
  return spans.filter((sp) => sp.end_ms > lo && sp.start_ms < hi).map((sp) => sp.id)
}

/** The result of a drag: those scenes, or added to the pick when a modifier was held. */
export function marqueeSelect(
  sel: SceneSelection,
  order: readonly number[],
  crossed: readonly number[],
  additive = false,
): SceneSelection {
  const ids = inOrder(additive ? [...sel.ids, ...crossed] : crossed, order)
  const anchor = crossed.length > 0 ? inOrder(crossed, order)[0] : sel.anchor
  return { ids, anchor: ids.length > 0 ? anchor : null }
}

/** Drops scenes that are gone (removed, or replaced by the agent). Same object when nothing changed. */
export function pruneSelection(sel: SceneSelection, order: readonly number[]): SceneSelection {
  const ids = inOrder(sel.ids, order)
  const anchor = sel.anchor !== null && order.includes(sel.anchor) ? sel.anchor : null
  if (ids.length === sel.ids.length && ids.every((id, i) => id === sel.ids[i]) && anchor === sel.anchor) return sel
  return { ids, anchor }
}

export function isSelected(sel: SceneSelection, id: number): boolean {
  return sel.ids.includes(id)
}

/** What a message to the chat is about: the picked ids (≤ 12), or [] for the whole video. */
export function focusIds(sel: SceneSelection, order: readonly number[]): number[] {
  return inOrder(sel.ids, order).slice(0, MAX_FOCUS)
}

export interface FocusChip {
  id: number
  /** 1-based scene number on the timeline. */
  n: number
  label: string
}

/**
 * The composer's focus line: the first `max` picked scenes as chips
 * ("Scene 3 · Week's return"), and how many more are picked ("+2 more").
 * No chips = "Whole video".
 */
export function focusChips(
  sel: SceneSelection,
  scenes: ReadonlyArray<{ id: number; label: string }>,
  order: readonly number[],
  max = 2,
): { chips: FocusChip[]; more: number } {
  const byId = new Map(scenes.map((s) => [s.id, s]))
  const ids = focusIds(sel, order).filter((id) => byId.has(id))
  const chips = ids.slice(0, max).map((id) => ({ id, n: order.indexOf(id) + 1, label: byId.get(id)?.label ?? '' }))
  return { chips, more: Math.max(0, ids.length - chips.length) }
}

/** "Improve the visuals of scene 3: " — the prefill for "Improve with AI". */
export function improvePrompt(n: number): string {
  return `Improve the visuals of scene ${n}: `
}
