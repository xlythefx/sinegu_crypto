import { describe, expect, it } from 'vitest'
import {
  clickSelect,
  focusChips,
  focusIds,
  improvePrompt,
  marqueeSelect,
  MAX_FOCUS,
  NO_SELECTION,
  pruneSelection,
  scenesCrossed,
  type SceneSelection,
} from './selection'
import { sceneSpans } from './timeline'

// Four scenes in timeline order 10, 20, 30, 40 (ids deliberately not in position order in the input).
const ORDER = [10, 20, 30, 40]
const sel = (ids: number[], anchor: number | null = ids[ids.length - 1] ?? null): SceneSelection => ({ ids, anchor })

describe('clicking a scene', () => {
  it('a plain click picks that scene alone', () => {
    expect(clickSelect(sel([10, 20]), ORDER, 30)).toEqual({ ids: [30], anchor: 30 })
    expect(clickSelect(NO_SELECTION, ORDER, 20)).toEqual({ ids: [20], anchor: 20 })
  })

  it('Ctrl/Cmd adds a scene, or takes it back out, and keeps timeline order', () => {
    const a = clickSelect(sel([30]), ORDER, 10, { toggle: true })
    expect(a).toEqual({ ids: [10, 30], anchor: 10 })
    expect(clickSelect(a, ORDER, 30, { toggle: true })).toEqual({ ids: [10], anchor: 30 })
  })

  it('Shift picks the run from the anchor, in either direction', () => {
    expect(clickSelect(sel([20], 20), ORDER, 40, { range: true }).ids).toEqual([20, 30, 40])
    expect(clickSelect(sel([40], 40), ORDER, 10, { range: true }).ids).toEqual([10, 20, 30, 40])
    // The anchor stays put, so a second Shift + click re-measures from it.
    const once = clickSelect(sel([20], 20), ORDER, 40, { range: true })
    expect(clickSelect(once, ORDER, 30, { range: true }).ids).toEqual([20, 30])
  })

  it('Shift with no anchor picks just the clicked scene; Ctrl + Shift adds the run', () => {
    expect(clickSelect(NO_SELECTION, ORDER, 30, { range: true }).ids).toEqual([30])
    expect(clickSelect(sel([10], 30), ORDER, 40, { range: true, toggle: true }).ids).toEqual([10, 30, 40])
  })

  it('ignores a scene that is not on the timeline', () => {
    const s = sel([10])
    expect(clickSelect(s, ORDER, 99)).toBe(s)
  })
})

describe('dragging across the scene track', () => {
  const spans = sceneSpans([
    { id: 30, position: 3, seconds: 5, trim_in_ms: null, trim_out_ms: null },
    { id: 10, position: 1, seconds: 3, trim_in_ms: null, trim_out_ms: null },
    { id: 20, position: 2, seconds: 4, trim_in_ms: null, trim_out_ms: null },
    { id: 40, position: 4, seconds: 2, trim_in_ms: null, trim_out_ms: null },
  ])
  // 10: 0–3 s · 20: 3–7 s · 30: 7–12 s · 40: 12–14 s

  it('picks every scene the drag crosses, either direction', () => {
    expect(scenesCrossed(spans, 2000, 8000)).toEqual([10, 20, 30])
    expect(scenesCrossed(spans, 8000, 2000)).toEqual([10, 20, 30])
  })

  it('touching an edge is not crossing', () => {
    expect(scenesCrossed(spans, 3000, 7000)).toEqual([20])
    expect(scenesCrossed(spans, 14000, 20000)).toEqual([])
  })

  it('replaces the pick, or adds to it with a modifier', () => {
    expect(marqueeSelect(sel([40]), ORDER, [20, 30])).toEqual({ ids: [20, 30], anchor: 20 })
    expect(marqueeSelect(sel([40]), ORDER, [20, 10], true)).toEqual({ ids: [10, 20, 40], anchor: 10 })
    expect(marqueeSelect(sel([40]), ORDER, [])).toEqual(NO_SELECTION)
  })
})

describe('the focus sent to the chat', () => {
  const scenes = [
    { id: 10, label: 'Hook' },
    { id: 20, label: 'Week’s return' },
    { id: 30, label: 'City' },
    { id: 40, label: 'Goodbye' },
  ]

  it('drops scenes that are gone, and keeps the same object when nothing changed', () => {
    const s = sel([20, 30], 30)
    expect(pruneSelection(s, ORDER)).toBe(s)
    expect(pruneSelection(s, [10, 20, 40])).toEqual({ ids: [20], anchor: null })
  })

  it('chips name the scene number and label, the rest are counted', () => {
    expect(focusChips(sel([40, 20, 30]), scenes, ORDER)).toEqual({
      chips: [
        { id: 20, n: 2, label: 'Week’s return' },
        { id: 30, n: 3, label: 'City' },
      ],
      more: 1,
    })
    expect(focusChips(NO_SELECTION, scenes, ORDER)).toEqual({ chips: [], more: 0 })
  })

  it('sends at most 12 ids, in timeline order', () => {
    const many = Array.from({ length: 20 }, (_, i) => i + 1)
    expect(focusIds(sel([...many].reverse()), many)).toEqual(many.slice(0, MAX_FOCUS))
    expect(focusIds(NO_SELECTION, ORDER)).toEqual([])
  })

  it('prefills the improve prompt with the scene number', () => {
    expect(improvePrompt(3)).toBe('Improve the visuals of scene 3: ')
  })
})
