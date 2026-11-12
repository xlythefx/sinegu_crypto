import { describe, expect, it } from 'vitest'
import { composeTune, midiToHz, mulberry32, TUNE_PRESETS } from './chiptune'
import { sfxDurationMs, sfxEvents } from './sfx'
import type { MusicPreset, SfxSound } from '../../types/creativeVideos'

const PRESETS = Object.keys(TUNE_PRESETS) as MusicPreset[]
const SOUNDS: SfxSound[] = ['coin', 'powerup', 'blip', 'levelup', 'select']

describe('mulberry32', () => {
  it('is deterministic and in [0, 1)', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const xs = Array.from({ length: 50 }, () => a())
    expect(xs).toEqual(Array.from({ length: 50 }, () => b()))
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true)
  })
})

describe('composeTune', () => {
  it.each(PRESETS)('%s: the same seed always composes the same notes', (preset) => {
    expect(composeTune(preset, 1234, 20_000)).toEqual(composeTune(preset, 1234, 20_000))
  })

  it('a new seed composes a different melody', () => {
    const lead = (seed: number) =>
      composeTune('arcade-upbeat', seed, 12_000)
        .events.filter((e) => e.channel === 'lead')
        .map((e) => Math.round(e.freq))
    expect(lead(1)).not.toEqual(lead(2))
  })

  it.each(PRESETS)('%s: fits inside the requested length', (preset) => {
    const plan = composeTune(preset, 7, 9_000)
    expect(plan.events.length).toBeGreaterThan(0)
    for (const e of plan.events) {
      expect(e.start).toBeGreaterThanOrEqual(0)
      expect(e.start + e.duration).toBeLessThanOrEqual(9 + 1e-9)
    }
  })

  it('loops cleanly: the second phrase repeats the first exactly', () => {
    const plan = composeTune('arcade-chill', 99, 120_000)
    const loop = plan.loopSeconds
    const key = (e: { channel: string; freq: number; start: number }, shift: number) => [e.channel, e.freq, +(e.start - shift).toFixed(6)]
    const first = plan.events.filter((e) => e.start < loop).map((e) => key(e, 0))
    const second = plan.events.filter((e) => e.start >= loop && e.start < 2 * loop).map((e) => key(e, loop))
    expect(second).toEqual(first)
  })

  it('the loop is a whole 8 bars', () => {
    const plan = composeTune('arcade-boss', 3, 30_000)
    const bar = (60 / plan.bpm) * 4
    expect(plan.loopSeconds / bar).toBeCloseTo(8, 9)
  })

  it('is sorted by start time', () => {
    const ev = composeTune('arcade-victory', 5, 15_000).events
    for (let i = 1; i < ev.length; i++) expect(ev[i].start).toBeGreaterThanOrEqual(ev[i - 1].start)
  })

  it('a zero length has no notes', () => {
    expect(composeTune('arcade-upbeat', 1, 0).events).toEqual([])
  })
})

describe('sound effects', () => {
  it.each(SOUNDS)('%s is short, starts at 0 and is the same each time', (s) => {
    const ev = sfxEvents(s)
    expect(ev.length).toBeGreaterThan(0)
    expect(Math.min(...ev.map((e) => e.start))).toBe(0)
    expect(sfxDurationMs(s)).toBeLessThan(1000)
    expect(sfxEvents(s)).toEqual(ev)
  })

  it('the coin rises (B5 then E6)', () => {
    const [a, b] = sfxEvents('coin')
    expect(a.freq).toBeCloseTo(midiToHz(83))
    expect(b.freq).toBeGreaterThan(a.freq)
  })
})
