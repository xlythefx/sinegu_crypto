import { describe, expect, it } from 'vitest'
import { DUCK_ATTACK_S, DUCK_RELEASE_S, duckingEnvelope, hasSoundtrack, musicGainAt, type MusicGainOptions } from './audioMix'
import type { TimelineDoc } from '../../types/creativeVideos'

const silent: TimelineDoc = {
  version: 1,
  caption_style: 'bold',
  captions: [],
  look: { pixel_size: 0, scanlines: false },
  music: null,
  voiceover: null,
  sfx: [],
  clip_audio_volume: 1,
  ducking: { enabled: true, music_under_voice: 0.25 },
}

const base: MusicGainOptions = { volume: 0.8, totalSec: 20, fadeOutSec: 2, voice: { start: 5, end: 10 }, underVoice: 0.25 }

describe('musicGainAt', () => {
  it('plays at its volume away from the voice and the end', () => {
    expect(musicGainAt(1, base)).toBeCloseTo(0.8)
    expect(musicGainAt(14, base)).toBeCloseTo(0.8)
  })

  it('dips under the voice to volume × under', () => {
    expect(musicGainAt(7.5, base)).toBeCloseTo(0.2)
    expect(musicGainAt(5, base)).toBeCloseTo(0.2)
    expect(musicGainAt(10, base)).toBeCloseTo(0.2)
  })

  it('ramps down before the voice and back up after it', () => {
    expect(musicGainAt(5 - DUCK_ATTACK_S / 2, base)).toBeCloseTo(0.8 * (1 - 0.75 / 2))
    expect(musicGainAt(10 + DUCK_RELEASE_S / 2, base)).toBeCloseTo(0.8 * (0.25 + 0.75 / 2))
    expect(musicGainAt(10 + DUCK_RELEASE_S, base)).toBeCloseTo(0.8)
  })

  it('fades to silence at the end', () => {
    expect(musicGainAt(19, base)).toBeCloseTo(0.4)
    expect(musicGainAt(20, base)).toBe(0)
  })

  it('without a voice (or with ducking off) only the fade applies', () => {
    expect(musicGainAt(7.5, { ...base, voice: null })).toBeCloseTo(0.8)
  })
})

describe('duckingEnvelope', () => {
  it('is sorted, starts at 0, ends silent at the total and matches musicGainAt at every point', () => {
    const pts = duckingEnvelope(base)
    expect(pts[0].t).toBe(0)
    expect(pts[pts.length - 1]).toEqual({ t: 20, v: 0 })
    for (let i = 1; i < pts.length; i++) expect(pts[i].t).toBeGreaterThan(pts[i - 1].t)
    for (const p of pts) expect(p.v).toBeCloseTo(musicGainAt(p.t, base))
  })

  it('has every corner of the dip and the fade', () => {
    const ts = duckingEnvelope(base).map((p) => p.t)
    for (const t of [5 - DUCK_ATTACK_S, 5, 10, 10 + DUCK_RELEASE_S, 18]) expect(ts).toContain(t)
  })

  it('a voice running past the end is cut at the video’s end', () => {
    const pts = duckingEnvelope({ ...base, voice: { start: 19, end: 30 } })
    expect(pts.every((p) => p.t <= 20)).toBe(true)
  })
})

describe('hasSoundtrack', () => {
  it('is false for a silent timeline and true with one effect', () => {
    expect(hasSoundtrack(silent)).toBe(false)
    expect(hasSoundtrack({ ...silent, sfx: [{ id: 'a', sound: 'coin', at_ms: 0, volume: 1 }] })).toBe(true)
  })
})
