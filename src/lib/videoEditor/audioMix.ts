/**
 * The video's soundtrack, mixed in one OfflineAudioContext on the MAIN thread
 * (a worker has no OfflineAudioContext): the music (an uploaded file or the
 * built-in chiptune) with its fade-out and ducking under the voiceover, the
 * voiceover, the sound effects, and each Seedance clip's own sound for the
 * part of the clip that is used. The export hands the result to the encoder
 * worker as planar Float32 channels; the preview plays the SAME mix (minus
 * the clips' sound, which the preview's <video> elements play themselves).
 *
 * `musicGainAt` / `duckingEnvelope` are pure (unit-tested): the music's level
 * at any moment is volume × ducking × fade-out.
 */

import type { TimelineDoc } from '../../types/creativeVideos'
import { composeTune, scheduleNotes } from './chiptune'
import { scheduleSfx } from './sfx'

export const MIX_SAMPLE_RATE = 48_000

/** How long the music takes to dip under the voice, and to come back. */
export const DUCK_ATTACK_S = 0.25
export const DUCK_RELEASE_S = 0.45

export interface GainPoint {
  /** Seconds on the video's clock. */
  t: number
  v: number
}

export interface MusicGainOptions {
  /** The music's own volume (0–1). */
  volume: number
  /** Total length of the video, seconds. */
  totalSec: number
  /** Fade to silence over the last N seconds (0 = none). */
  fadeOutSec: number
  /** Where the voice speaks, seconds — null = no voiceover (or ducking off). */
  voice: { start: number; end: number } | null
  /** The music's level under the voice, as a fraction of its volume (0.25). */
  underVoice: number
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** The ducking factor alone (1 = full, `underVoice` = dipped) at `t`. */
function duckFactor(t: number, o: MusicGainOptions): number {
  if (!o.voice || o.voice.end <= o.voice.start) return 1
  const under = clamp01(o.underVoice)
  const { start, end } = o.voice
  if (t <= start - DUCK_ATTACK_S || t >= end + DUCK_RELEASE_S) return 1
  if (t < start) return 1 - (1 - under) * ((t - (start - DUCK_ATTACK_S)) / DUCK_ATTACK_S)
  if (t <= end) return under
  return under + (1 - under) * ((t - end) / DUCK_RELEASE_S)
}

/** The fade-out factor alone at `t`. */
function fadeFactor(t: number, o: MusicGainOptions): number {
  if (o.fadeOutSec <= 0) return t >= o.totalSec ? 0 : 1
  const from = o.totalSec - o.fadeOutSec
  if (t <= from) return 1
  if (t >= o.totalSec) return 0
  return 1 - (t - from) / o.fadeOutSec
}

/** The music's gain at `t`: volume × ducking × fade-out. */
export function musicGainAt(t: number, o: MusicGainOptions): number {
  return clamp01(o.volume) * duckFactor(t, o) * fadeFactor(t, o)
}

/**
 * The music's gain as points to ramp between linearly: every corner of the
 * ducking and the fade, plus a point every 100 ms inside any ramp (where the
 * product of two ramps is not a straight line). Sorted, starting at 0.
 */
export function duckingEnvelope(o: MusicGainOptions): GainPoint[] {
  const times = new Set<number>([0, o.totalSec])
  const addRamp = (a: number, b: number) => {
    const lo = Math.max(0, a)
    const hi = Math.min(o.totalSec, b)
    if (hi <= lo) return
    times.add(lo)
    times.add(hi)
    for (let t = lo; t < hi; t += 0.1) times.add(Math.round(t * 1000) / 1000)
  }
  if (o.voice && o.voice.end > o.voice.start) {
    addRamp(o.voice.start - DUCK_ATTACK_S, o.voice.start)
    addRamp(o.voice.end, o.voice.end + DUCK_RELEASE_S)
  }
  if (o.fadeOutSec > 0) addRamp(o.totalSec - o.fadeOutSec, o.totalSec)
  return [...times]
    .filter((t) => t >= 0 && t <= o.totalSec)
    .sort((a, b) => a - b)
    .map((t) => ({ t, v: musicGainAt(t, o) }))
}

/** A clip's own sound, already cut to the part the timeline uses. */
export interface ClipAudio {
  /** Where it starts on the video's clock, ms. */
  startMs: number
  buffer: AudioBuffer
}

export interface MixInput {
  durationMs: number
  timeline: TimelineDoc
  /** The decoded music file (`music.source === 'asset'`), or null. */
  musicBuffer: AudioBuffer | null
  /** The decoded voiceover, or null. */
  voiceBuffer: AudioBuffer | null
  /** Seedance clips' own sound (export only; the preview's <video> plays it). */
  clips: ClipAudio[]
  sampleRate?: number
}

/** Where the voice speaks on the video's clock, seconds — or null. */
export function voiceSpan(timeline: TimelineDoc, voiceBuffer: AudioBuffer | null, totalSec: number): { start: number; end: number } | null {
  if (!timeline.voiceover || !voiceBuffer) return null
  const start = Math.max(0, timeline.voiceover.start_ms / 1000)
  const end = Math.min(totalSec, start + voiceBuffer.duration)
  return end > start ? { start, end } : null
}

function applyEnvelope(param: AudioParam, points: GainPoint[]): void {
  if (points.length === 0) return
  param.setValueAtTime(points[0].v, 0)
  for (let i = 1; i < points.length; i++) param.linearRampToValueAtTime(points[i].v, points[i].t)
}

/** Mix the whole soundtrack. Silent tracks are simply absent. */
export async function mixTimeline(input: MixInput): Promise<AudioBuffer> {
  const sampleRate = input.sampleRate ?? MIX_SAMPLE_RATE
  const totalSec = Math.max(0.1, input.durationMs / 1000)
  const ctx = new OfflineAudioContext(2, Math.ceil(totalSec * sampleRate), sampleRate)
  const tl = input.timeline

  // A gentle limiter so music + voice + effects never clip.
  const master = ctx.createDynamicsCompressor()
  master.threshold.value = -3
  master.knee.value = 6
  master.ratio.value = 12
  master.attack.value = 0.003
  master.release.value = 0.2
  master.connect(ctx.destination)

  // Music
  if (tl.music) {
    const musicGain = ctx.createGain()
    musicGain.connect(master)
    const voice = tl.ducking.enabled ? voiceSpan(tl, input.voiceBuffer, totalSec) : null
    applyEnvelope(
      musicGain.gain,
      duckingEnvelope({
        volume: tl.music.volume,
        totalSec,
        fadeOutSec: Math.max(0, tl.music.fade_out_ms / 1000),
        voice,
        underVoice: tl.ducking.music_under_voice,
      }),
    )
    if (tl.music.source === 'chiptune') {
      scheduleNotes(ctx, musicGain, composeTune(tl.music.preset, tl.music.seed, totalSec * 1000).events)
    } else if (input.musicBuffer) {
      const src = ctx.createBufferSource()
      src.buffer = input.musicBuffer
      src.connect(musicGain)
      src.start(Math.max(0, tl.music.start_ms / 1000))
    }
  }

  // Voiceover
  if (tl.voiceover && input.voiceBuffer) {
    const g = ctx.createGain()
    g.gain.value = clamp01(tl.voiceover.volume)
    g.connect(master)
    const src = ctx.createBufferSource()
    src.buffer = input.voiceBuffer
    src.connect(g)
    src.start(Math.max(0, tl.voiceover.start_ms / 1000))
  }

  // Sound effects
  if (tl.sfx.length > 0) {
    const sfxBus = ctx.createGain()
    sfxBus.connect(master)
    for (const s of tl.sfx) {
      if (s.at_ms / 1000 < totalSec) scheduleSfx(ctx, sfxBus, s.sound, s.at_ms / 1000, clamp01(s.volume))
    }
  }

  // The clips' own sound (Seedance)
  if (input.clips.length > 0 && tl.clip_audio_volume > 0) {
    const clipBus = ctx.createGain()
    clipBus.gain.value = clamp01(tl.clip_audio_volume)
    clipBus.connect(master)
    for (const c of input.clips) {
      const src = ctx.createBufferSource()
      src.buffer = c.buffer
      src.connect(clipBus)
      src.start(Math.max(0, c.startMs / 1000))
    }
  }

  return ctx.startRendering()
}

/** The mix as one Float32Array per channel — transferable to the encoder worker. */
export function toPlanar(buffer: AudioBuffer): Float32Array[] {
  const out: Float32Array[] = []
  for (let c = 0; c < buffer.numberOfChannels; c++) out.push(new Float32Array(buffer.getChannelData(c)))
  return out
}

/** True when the timeline has anything to hear besides the clips themselves. */
export function hasSoundtrack(tl: TimelineDoc): boolean {
  return tl.music !== null || tl.voiceover !== null || tl.sfx.length > 0
}
