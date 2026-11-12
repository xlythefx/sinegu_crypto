/**
 * The editor's timeline arithmetic — PURE (no React, no DOM): where each
 * scene starts and ends after its trims, the total, clamping a trim, moving
 * a scene, which captions show at a moment and whether the video is over the
 * cap. The preview player, the timeline strip and the export all read the
 * SAME spans, so what plays is what is exported.
 */

import type { TimelineCaption } from '../../types/creativeVideos'

/** The fields of a scene the arithmetic needs. */
export interface TimedScene {
  id: number
  position: number
  seconds: number
  trim_in_ms: number | null
  trim_out_ms: number | null
}

/** A trim never leaves less than this much of a scene. */
export const MIN_SCENE_MS = 500
/** Trim handles snap to this. */
export const TRIM_STEP_MS = 50

export interface SceneSpan {
  id: number
  index: number
  /** Where the scene starts and ends on the video's clock. */
  start_ms: number
  end_ms: number
  /** Where it starts and ends inside its own clip. */
  in_ms: number
  out_ms: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function fullMs(scene: TimedScene): number {
  return Math.max(0, Math.round(scene.seconds * 1000))
}

/** The trims as they will be used: inside the clip, and at least MIN_SCENE_MS apart. */
export function effectiveTrim(scene: TimedScene): { in_ms: number; out_ms: number } {
  const full = fullMs(scene)
  const min = Math.min(MIN_SCENE_MS, full)
  const outRaw = scene.trim_out_ms ?? full
  const out_ms = clamp(outRaw, min, full)
  const in_ms = clamp(scene.trim_in_ms ?? 0, 0, out_ms - min)
  return { in_ms, out_ms }
}

export function sceneDurationMs(scene: TimedScene): number {
  const { in_ms, out_ms } = effectiveTrim(scene)
  return out_ms - in_ms
}

/** Scenes in position order. */
export function ordered<T extends TimedScene>(scenes: readonly T[]): T[] {
  return [...scenes].sort((a, b) => a.position - b.position || a.id - b.id)
}

/** Every scene laid end to end, in position order. */
export function sceneSpans(scenes: readonly TimedScene[]): SceneSpan[] {
  let at = 0
  return ordered(scenes).map((s, index) => {
    const { in_ms, out_ms } = effectiveTrim(s)
    const span = { id: s.id, index, start_ms: at, end_ms: at + (out_ms - in_ms), in_ms, out_ms }
    at = span.end_ms
    return span
  })
}

export function totalMs(scenes: readonly TimedScene[]): number {
  return scenes.reduce((sum, s) => sum + sceneDurationMs(s), 0)
}

/** Longer than the cap (30 s): the server refuses to save it and export is blocked. */
export function overCap(scenes: readonly TimedScene[], maxSeconds: number): boolean {
  return totalMs(scenes) > maxSeconds * 1000
}

/** How much room is left under the cap (never negative). */
export function remainingMs(scenes: readonly TimedScene[], maxSeconds: number): number {
  return Math.max(0, maxSeconds * 1000 - totalMs(scenes))
}

/**
 * A trim handle dragged to `ms` (inside the clip): the new trims, snapped,
 * inside the clip, at least MIN_SCENE_MS long, and — when `maxDurationMs` is
 * given — no longer than that (the room the other scenes leave under the cap).
 * A trim at the clip's own edge is stored as null ("untrimmed").
 */
export function clampTrim(
  scene: TimedScene,
  edge: 'in' | 'out',
  ms: number,
  maxDurationMs?: number,
): { trim_in_ms: number | null; trim_out_ms: number | null } {
  const full = fullMs(scene)
  const min = Math.min(MIN_SCENE_MS, full)
  const cur = effectiveTrim(scene)
  const snapped = Math.round(ms / TRIM_STEP_MS) * TRIM_STEP_MS
  let in_ms = cur.in_ms
  let out_ms = cur.out_ms
  if (edge === 'in') {
    in_ms = clamp(snapped, 0, out_ms - min)
    if (maxDurationMs !== undefined && out_ms - in_ms > maxDurationMs) in_ms = out_ms - Math.max(min, maxDurationMs)
  } else {
    out_ms = clamp(snapped, in_ms + min, full)
    if (maxDurationMs !== undefined && out_ms - in_ms > maxDurationMs) out_ms = in_ms + Math.max(min, maxDurationMs)
  }
  return { trim_in_ms: in_ms <= 0 ? null : in_ms, trim_out_ms: out_ms >= full ? null : out_ms }
}

/**
 * Move one scene `delta` places (−1 = left, +1 = right). Positions are
 * renumbered with the SAME set of numbers the scenes already had, so the
 * server's own numbering (0- or 1-based) is kept. Unchanged at an end.
 */
export function moveScene<T extends TimedScene>(scenes: readonly T[], id: number, delta: number): T[] {
  const list = ordered(scenes)
  const from = list.findIndex((s) => s.id === id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= list.length || delta === 0) return list
  const slots = list.map((s) => s.position)
  const [moved] = list.splice(from, 1)
  list.splice(to, 0, moved)
  return list.map((s, i) => (s.position === slots[i] ? s : { ...s, position: slots[i] }))
}

/** The scene playing at `ms` and how far into its clip, or null past the end. */
export function sceneAt(spans: readonly SceneSpan[], ms: number): { span: SceneSpan; clipMs: number } | null {
  for (const span of spans) {
    if (ms >= span.start_ms && ms < span.end_ms) return { span, clipMs: span.in_ms + (ms - span.start_ms) }
  }
  return null
}

/** The captions on screen at `ms`. */
export function captionsAt<C extends Pick<TimelineCaption, 'start_ms' | 'end_ms'>>(captions: readonly C[], ms: number): C[] {
  return captions.filter((c) => ms >= c.start_ms && ms < c.end_ms)
}

/** A caption kept on the video's clock, at least 300 ms long. */
export function clampCaption<C extends Pick<TimelineCaption, 'start_ms' | 'end_ms'>>(caption: C, total: number): C {
  const end = clamp(Math.round(caption.end_ms), 300, Math.max(300, total))
  const start = clamp(Math.round(caption.start_ms), 0, end - 300)
  return { ...caption, start_ms: start, end_ms: end }
}
