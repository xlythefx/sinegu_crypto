/**
 * Built-in arcade music (Creatives v2, owner's request): a procedural chiptune
 * generator. Deterministic — the same preset and seed always compose the same
 * notes — so a tune needs no file, no licence and no storage: the timeline
 * keeps `{preset, seed}` and every preview and export renders it again.
 *
 * Four classic channels: two pulse/square voices (lead + arpeggio), a
 * triangle bass and a noise drum kit. The music is a 4-bar loop played twice
 * with the second pass's last bar varied (an 8-bar phrase), repeated to fill
 * any length; every phrase is whole bars, so it loops without a seam.
 *
 * `composeTune` is PURE (the note list — unit-tested); `scheduleNotes` puts a
 * note list onto any Web Audio context, which is how both the preview and the
 * export mix (lib/videoEditor/audioMix.ts) play it, and sfx.ts reuses it.
 */

import type { MusicPreset } from '../../types/creativeVideos'

export type Wave = 'square' | 'pulse' | 'triangle' | 'noise'
export type Drum = 'kick' | 'snare' | 'hat'

export interface NoteEvent {
  channel: 'lead' | 'arp' | 'bass' | 'drums' | 'sfx'
  wave: Wave
  /** Seconds from the start. */
  start: number
  duration: number
  /** Hz (ignored for noise drums). */
  freq: number
  /** A pitch slide to this frequency over the note (sound effects). */
  slideTo?: number
  /** 0–1 before the track's volume. */
  gain: number
  drum?: Drum
}

export interface TunePlan {
  preset: MusicPreset
  seed: number
  bpm: number
  /** One 8-bar phrase, in seconds — the loop length. */
  loopSeconds: number
  /** Every note, sorted by start, cut at the requested length. */
  events: NoteEvent[]
}

/* ---------- the seeded PRNG ---------- */

/** mulberry32: small, fast and the same on every browser. Returns [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A fresh seed for "New tune" (1–99,999, like the server's). */
export function randomSeed(): number {
  return 1 + Math.floor(Math.random() * 99_999)
}

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/* ---------- presets ---------- */

interface PresetDef {
  bpm: number
  /** Root of the key, MIDI. */
  root: number
  /** Scale steps in semitones from the root. */
  scale: readonly number[]
  /** Chord per bar, as a scale degree (0-based). Four bars. */
  progression: readonly number[]
  /** Lead notes per beat (2 = eighths). */
  leadPerBeat: number
  /** Chance a lead step rests. */
  rest: number
  leadWave: Wave
  /** Arpeggio notes per beat; 0 = no arpeggio channel. */
  arpPerBeat: number
  /** Bass notes per beat. */
  bassPerBeat: number
  /** Kick on these beats of the bar (0-based); snare on `snare`. */
  kick: readonly number[]
  snare: readonly number[]
  /** Hats per beat; 0 = none. */
  hatPerBeat: number
  /** Long held lead notes for a fanfare. */
  fanfare?: boolean
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11] as const
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11] as const

export const TUNE_PRESETS: Record<MusicPreset, PresetDef> = {
  'arcade-upbeat': {
    bpm: 148, root: 72, scale: MAJOR, progression: [0, 4, 5, 3],
    leadPerBeat: 2, rest: 0.18, leadWave: 'pulse', arpPerBeat: 4, bassPerBeat: 2,
    kick: [0, 2], snare: [1, 3], hatPerBeat: 2,
  },
  'arcade-chill': {
    bpm: 92, root: 69, scale: MAJOR, progression: [5, 3, 0, 4],
    leadPerBeat: 1, rest: 0.3, leadWave: 'triangle', arpPerBeat: 2, bassPerBeat: 1,
    kick: [0], snare: [2], hatPerBeat: 1,
  },
  'arcade-boss': {
    bpm: 166, root: 64, scale: HARMONIC_MINOR, progression: [0, 5, 6, 4],
    leadPerBeat: 2, rest: 0.12, leadWave: 'square', arpPerBeat: 0, bassPerBeat: 4,
    kick: [0, 1, 2, 3], snare: [1, 3], hatPerBeat: 4,
  },
  'arcade-victory': {
    bpm: 128, root: 67, scale: MAJOR, progression: [0, 3, 4, 0],
    leadPerBeat: 1, rest: 0.05, leadWave: 'pulse', arpPerBeat: 4, bassPerBeat: 2,
    kick: [0, 2], snare: [1, 3], hatPerBeat: 2, fanfare: true,
  },
}

/** The scale degree `d` (any integer) as a MIDI note, octaves folded in. */
function degreeToMidi(def: PresetDef, degree: number): number {
  const n = def.scale.length
  const octave = Math.floor(degree / n)
  const step = ((degree % n) + n) % n
  return def.root + octave * 12 + def.scale[step]
}

/* ---------- composing (pure) ---------- */

const BEATS_PER_BAR = 4
const LOOP_BARS = 4

/** One bar's lead melody: a seeded walk on the scale, pulled toward the chord's tones. */
function leadBar(def: PresetDef, chord: number, rand: () => number, startDegree: number): { degrees: (number | null)[]; end: number } {
  const steps = def.leadPerBeat * BEATS_PER_BAR
  const out: (number | null)[] = []
  let d = startDegree
  for (let i = 0; i < steps; i++) {
    if (def.fanfare) {
      // Long chord tones, a step every beat, landing on the root at the bar's end.
      const tones = [chord, chord + 2, chord + 4, chord + 7]
      d = i === steps - 1 ? chord + 7 : tones[Math.floor(rand() * tones.length)]
      out.push(d)
      continue
    }
    if (i > 0 && rand() < def.rest) {
      out.push(null)
      continue
    }
    const onBeat = i % def.leadPerBeat === 0
    const move = Math.floor(rand() * 5) - 2 // −2 … +2 scale steps
    d += move
    // On the beat, snap to the nearest chord tone so the melody fits the harmony.
    if (onBeat) {
      const tones = [chord, chord + 2, chord + 4, chord + 7, chord + 9]
      d = tones.reduce((best, t) => (Math.abs(t - d) < Math.abs(best - d) ? t : best), tones[0])
    }
    // Keep it in a singable range around the root.
    if (d < -2) d += 7
    if (d > 11) d -= 7
    out.push(d)
  }
  return { degrees: out, end: d }
}

interface Bar {
  chord: number
  lead: (number | null)[]
}

/** The 8-bar phrase: four composed bars, then the same four with the last bar varied. */
function composePhrase(def: PresetDef, rand: () => number): Bar[] {
  const bars: Bar[] = []
  let d = 4
  for (let b = 0; b < LOOP_BARS; b++) {
    const chord = def.progression[b % def.progression.length]
    const { degrees, end } = leadBar(def, chord, rand, d)
    bars.push({ chord, lead: degrees })
    d = end
  }
  const second = bars.slice(0, LOOP_BARS - 1).map((b) => ({ ...b }))
  const lastChord = def.progression[(LOOP_BARS - 1) % def.progression.length]
  // The variation resolves to the root so the phrase closes before it loops.
  const varied = leadBar(def, lastChord, rand, d).degrees
  varied[varied.length - 1] = 7
  second.push({ chord: lastChord, lead: varied })
  return [...bars, ...second]
}

function phraseEvents(def: PresetDef, bars: Bar[], offset: number): NoteEvent[] {
  const beat = 60 / def.bpm
  const bar = beat * BEATS_PER_BAR
  const events: NoteEvent[] = []
  bars.forEach((b, bi) => {
    const t0 = offset + bi * bar
    // Lead
    const leadStep = beat / def.leadPerBeat
    b.lead.forEach((deg, i) => {
      if (deg === null) return
      // A note holds through the rests after it.
      let len = 1
      while (i + len < b.lead.length && b.lead[i + len] === null) len++
      events.push({
        channel: 'lead', wave: def.leadWave, start: t0 + i * leadStep,
        duration: leadStep * len * (def.fanfare ? 0.95 : 0.82), freq: midiToHz(degreeToMidi(def, deg)), gain: 0.32,
      })
    })
    // Arpeggio: the chord's tones, an octave under the lead, cycling.
    if (def.arpPerBeat > 0) {
      const tones = [b.chord, b.chord + 2, b.chord + 4, b.chord + 2]
      const step = beat / def.arpPerBeat
      for (let i = 0; i < def.arpPerBeat * BEATS_PER_BAR; i++) {
        events.push({
          channel: 'arp', wave: 'square', start: t0 + i * step, duration: step * 0.7,
          freq: midiToHz(degreeToMidi(def, tones[i % tones.length]) - 12), gain: 0.1,
        })
      }
    }
    // Bass: the chord's root two octaves down, the fifth on off-steps.
    const bassStep = beat / def.bassPerBeat
    for (let i = 0; i < def.bassPerBeat * BEATS_PER_BAR; i++) {
      const deg = i % 4 === 2 ? b.chord + 4 : b.chord
      events.push({
        channel: 'bass', wave: 'triangle', start: t0 + i * bassStep, duration: bassStep * 0.9,
        freq: midiToHz(degreeToMidi(def, deg) - 24), gain: 0.42,
      })
    }
    // Drums
    for (const k of def.kick) {
      events.push({ channel: 'drums', wave: 'triangle', drum: 'kick', start: t0 + k * beat, duration: 0.16, freq: 140, slideTo: 42, gain: 0.7 })
    }
    for (const s of def.snare) {
      events.push({ channel: 'drums', wave: 'noise', drum: 'snare', start: t0 + s * beat, duration: 0.14, freq: 0, gain: 0.32 })
    }
    if (def.hatPerBeat > 0) {
      const step = beat / def.hatPerBeat
      for (let i = 0; i < def.hatPerBeat * BEATS_PER_BAR; i++) {
        events.push({ channel: 'drums', wave: 'noise', drum: 'hat', start: t0 + i * step, duration: 0.035, freq: 0, gain: i % 2 === 0 ? 0.13 : 0.08 })
      }
    }
  })
  return events
}

/**
 * Every note of `preset` + `seed` for `lengthMs` — pure and deterministic.
 * The phrase repeats until the length; notes that would start after it are
 * dropped, and the last ones are cut at the end.
 */
export function composeTune(preset: MusicPreset, seed: number, lengthMs: number): TunePlan {
  const def = TUNE_PRESETS[preset] ?? TUNE_PRESETS['arcade-upbeat']
  const rand = mulberry32(seed)
  const bars = composePhrase(def, rand)
  const loopSeconds = (60 / def.bpm) * BEATS_PER_BAR * bars.length
  const length = Math.max(0, lengthMs) / 1000
  const phrase = phraseEvents(def, bars, 0)
  const events: NoteEvent[] = []
  for (let offset = 0; offset < length; offset += loopSeconds) {
    for (const e of phrase) {
      const start = e.start + offset
      if (start >= length) continue
      events.push({ ...e, start, duration: Math.min(e.duration, length - start) })
    }
  }
  events.sort((a, b) => a.start - b.start || a.channel.localeCompare(b.channel))
  return { preset, seed, bpm: def.bpm, loopSeconds, events }
}

/* ---------- playing (Web Audio) ---------- */

const PULSE_DUTY = 0.25
const waveCache = new WeakMap<BaseAudioContext, PeriodicWave>()
const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>()

/** A 25% pulse wave — the classic NES lead tone. */
function pulseWave(ctx: BaseAudioContext): PeriodicWave {
  const cached = waveCache.get(ctx)
  if (cached) return cached
  const n = 32
  const real = new Float32Array(n)
  const imag = new Float32Array(n)
  for (let k = 1; k < n; k++) {
    // Fourier series of a pulse train with duty d.
    real[k] = (2 / (k * Math.PI)) * Math.sin(2 * Math.PI * k * PULSE_DUTY)
    imag[k] = (2 / (k * Math.PI)) * (1 - Math.cos(2 * Math.PI * k * PULSE_DUTY))
  }
  const wave = ctx.createPeriodicWave(real, imag)
  waveCache.set(ctx, wave)
  return wave
}

/** One second of white noise, from a fixed seed so every render is the same. */
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const cached = noiseCache.get(ctx)
  if (cached) return cached
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = buf.getChannelData(0)
  const rand = mulberry32(0xc0ffee)
  for (let i = 0; i < data.length; i++) data[i] = rand() * 2 - 1
  noiseCache.set(ctx, buf)
  return buf
}

/**
 * Put `events` onto `ctx`, into `destination`, starting `offset` seconds into
 * the context's clock. Each note gets its own short attack and release so
 * nothing clicks. `fromSeconds` skips notes that end before it (a preview
 * that starts mid-song).
 */
export function scheduleNotes(
  ctx: BaseAudioContext,
  destination: AudioNode,
  events: readonly NoteEvent[],
  offset = 0,
  volume = 1,
  fromSeconds = 0,
): void {
  for (const e of events) {
    if (e.start + e.duration <= fromSeconds) continue
    const t = offset + e.start - fromSeconds
    if (t < 0) continue
    const end = t + e.duration
    const g = ctx.createGain()
    const peak = e.gain * volume
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + Math.min(0.006, e.duration / 4))
    if (e.channel === 'drums' || e.channel === 'sfx') {
      g.gain.exponentialRampToValueAtTime(Math.max(peak * 0.02, 0.0001), end)
    } else {
      g.gain.setValueAtTime(peak, Math.max(t, end - 0.02))
      g.gain.linearRampToValueAtTime(0, end)
    }
    g.connect(destination)

    if (e.wave === 'noise') {
      const src = ctx.createBufferSource()
      src.buffer = noiseBuffer(ctx)
      const filter = ctx.createBiquadFilter()
      if (e.drum === 'hat') {
        filter.type = 'highpass'
        filter.frequency.value = 7000
      } else {
        filter.type = 'bandpass'
        filter.frequency.value = 1800
        filter.Q.value = 0.8
      }
      src.connect(filter)
      filter.connect(g)
      src.start(t, (e.start * 0.37) % 0.5)
      src.stop(end + 0.01)
      continue
    }

    const osc = ctx.createOscillator()
    if (e.wave === 'pulse') osc.setPeriodicWave(pulseWave(ctx))
    else osc.type = e.wave
    osc.frequency.setValueAtTime(e.freq, t)
    if (e.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, e.slideTo), end)
    osc.connect(g)
    osc.start(t)
    osc.stop(end + 0.01)
  }
}

/** Render a tune to an AudioBuffer (stereo, 48 kHz) — the music panel's preview. */
export async function renderTune(
  preset: MusicPreset,
  seed: number,
  lengthMs: number,
  sampleRate = 48_000,
): Promise<AudioBuffer> {
  const seconds = Math.max(0.5, lengthMs / 1000)
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate)
  scheduleNotes(ctx, ctx.destination, composeTune(preset, seed, seconds * 1000).events)
  return ctx.startRendering()
}
