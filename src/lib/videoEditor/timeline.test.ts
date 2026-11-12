import { describe, expect, it } from 'vitest'
import {
  captionsAt,
  clampCaption,
  clampTrim,
  effectiveTrim,
  MIN_SCENE_MS,
  moveScene,
  overCap,
  remainingMs,
  sceneAt,
  sceneDurationMs,
  sceneSpans,
  totalMs,
  type TimedScene,
} from './timeline'

const scene = (
  id: number,
  position: number,
  seconds: number,
  trim_in_ms: number | null = null,
  trim_out_ms: number | null = null,
): TimedScene => ({ id, position, seconds, trim_in_ms, trim_out_ms })

describe('spans and totals', () => {
  it('lays scenes end to end in position order, after their trims', () => {
    const spans = sceneSpans([scene(2, 1, 10, 1000, 6000), scene(1, 0, 5)])
    expect(spans.map((s) => s.id)).toEqual([1, 2])
    expect(spans[0]).toMatchObject({ start_ms: 0, end_ms: 5000, in_ms: 0, out_ms: 5000 })
    expect(spans[1]).toMatchObject({ start_ms: 5000, end_ms: 10000, in_ms: 1000, out_ms: 6000 })
  })

  it('totals the trimmed lengths', () => {
    const scenes = [scene(1, 0, 5), scene(2, 1, 10, 2000, null), scene(3, 2, 3, null, 1500)]
    expect(totalMs(scenes)).toBe(5000 + 8000 + 1500)
  })

  it('never lets a trim go outside the clip or below the minimum', () => {
    expect(effectiveTrim(scene(1, 0, 5, -400, 9000))).toEqual({ in_ms: 0, out_ms: 5000 })
    expect(sceneDurationMs(scene(1, 0, 5, 4900, 5000))).toBe(MIN_SCENE_MS)
  })

  it('knows the 30-second cap', () => {
    const six = [0, 1, 2, 3, 4, 5].map((i) => scene(i + 1, i, 5))
    expect(overCap(six, 30)).toBe(false)
    expect(overCap([...six, scene(7, 6, 5)], 30)).toBe(true)
    expect(remainingMs(six.slice(0, 4), 30)).toBe(10_000)
    expect(remainingMs([...six, scene(7, 6, 5)], 30)).toBe(0)
  })
})

describe('clampTrim', () => {
  it('snaps, clamps and stores an untrimmed edge as null', () => {
    const s = scene(1, 0, 10)
    expect(clampTrim(s, 'in', 1234)).toEqual({ trim_in_ms: 1250, trim_out_ms: null })
    expect(clampTrim(s, 'in', -50)).toEqual({ trim_in_ms: null, trim_out_ms: null })
    expect(clampTrim(s, 'out', 12_000)).toEqual({ trim_in_ms: null, trim_out_ms: null })
    expect(clampTrim(s, 'out', 4000)).toEqual({ trim_in_ms: null, trim_out_ms: 4000 })
  })

  it('keeps at least the minimum length', () => {
    const s = scene(1, 0, 10, 3000, 6000)
    expect(clampTrim(s, 'in', 5900)).toEqual({ trim_in_ms: 6000 - MIN_SCENE_MS, trim_out_ms: 6000 })
    expect(clampTrim(s, 'out', 3100)).toEqual({ trim_in_ms: 3000, trim_out_ms: 3000 + MIN_SCENE_MS })
  })

  it('stops a scene growing past the room left under the cap', () => {
    const s = scene(1, 0, 10, null, 4000)
    expect(clampTrim(s, 'out', 10_000, 6000)).toEqual({ trim_in_ms: null, trim_out_ms: 6000 })
  })
})

describe('moveScene', () => {
  const list = [scene(1, 1, 5), scene(2, 2, 5), scene(3, 3, 5)]

  it('swaps places and keeps the existing numbering', () => {
    const moved = moveScene(list, 3, -1)
    expect(moved.map((s) => [s.id, s.position])).toEqual([
      [1, 1],
      [3, 2],
      [2, 3],
    ])
  })

  it('does nothing at either end', () => {
    expect(moveScene(list, 1, -1).map((s) => s.id)).toEqual([1, 2, 3])
    expect(moveScene(list, 3, 1).map((s) => s.id)).toEqual([1, 2, 3])
  })
})

describe('playback lookups', () => {
  it('finds the scene and the moment inside its clip', () => {
    const spans = sceneSpans([scene(1, 0, 5), scene(2, 1, 10, 2000, null)])
    expect(sceneAt(spans, 4999)?.span.id).toBe(1)
    expect(sceneAt(spans, 5000)).toMatchObject({ span: { id: 2 }, clipMs: 2000 })
    expect(sceneAt(spans, 6500)?.clipMs).toBe(3500)
    expect(sceneAt(spans, 13_000)).toBeNull()
  })

  it('lists the captions on screen at a moment (end excluded)', () => {
    const caps = [
      { id: 'a', start_ms: 0, end_ms: 2000 },
      { id: 'b', start_ms: 1500, end_ms: 4000 },
    ]
    expect(captionsAt(caps, 1600).map((c) => c.id)).toEqual(['a', 'b'])
    expect(captionsAt(caps, 2000).map((c) => c.id)).toEqual(['b'])
  })

  it('keeps a caption on the clock and at least 300 ms long', () => {
    expect(clampCaption({ start_ms: 5000, end_ms: 4000 }, 10_000)).toEqual({ start_ms: 3700, end_ms: 4000 })
    expect(clampCaption({ start_ms: -10, end_ms: 99_000 }, 10_000)).toEqual({ start_ms: 0, end_ms: 10_000 })
  })
})
