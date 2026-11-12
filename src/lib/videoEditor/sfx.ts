/**
 * Arcade sound effects for the timeline (coin, power-up, blip, level-up,
 * select), synthesised the same way as the chiptune (lib/videoEditor/
 * chiptune.ts) — square and pulse voices with pitch slides, so they sit in
 * the same 8-bit world and need no file. `sfxEvents` is pure.
 */

import type { SfxSound } from '../../types/creativeVideos'
import { midiToHz, scheduleNotes, type NoteEvent } from './chiptune'

const note = (start: number, duration: number, midi: number, gain = 0.35, wave: NoteEvent['wave'] = 'square', slideMidi?: number): NoteEvent => ({
  channel: 'sfx',
  wave,
  start,
  duration,
  freq: midiToHz(midi),
  slideTo: slideMidi === undefined ? undefined : midiToHz(slideMidi),
  gain,
})

/** The notes of one effect, starting at 0 s. */
export function sfxEvents(sound: SfxSound): NoteEvent[] {
  switch (sound) {
    case 'coin':
      // The classic: B5 then a held E6.
      return [note(0, 0.07, 83, 0.3, 'pulse'), note(0.07, 0.38, 88, 0.3, 'pulse')]
    case 'powerup': {
      const out: NoteEvent[] = []
      const steps = [60, 64, 67, 72, 64, 67, 72, 76, 67, 72, 76, 79]
      steps.forEach((m, i) => out.push(note(i * 0.045, 0.06, m, 0.26, 'square')))
      return out
    }
    case 'blip':
      return [note(0, 0.06, 81, 0.3, 'square', 86)]
    case 'levelup':
      return [
        note(0, 0.1, 72, 0.3, 'pulse'),
        note(0.1, 0.1, 76, 0.3, 'pulse'),
        note(0.2, 0.1, 79, 0.3, 'pulse'),
        note(0.3, 0.45, 84, 0.32, 'pulse'),
        note(0.3, 0.45, 72, 0.18, 'triangle'),
      ]
    case 'select':
      return [note(0, 0.05, 76, 0.28, 'square'), note(0.05, 0.09, 83, 0.28, 'square')]
  }
}

/** How long an effect rings, in ms (for its block on the timeline). */
export function sfxDurationMs(sound: SfxSound): number {
  const ev = sfxEvents(sound)
  return Math.round(Math.max(...ev.map((e) => e.start + e.duration)) * 1000)
}

/** Put one effect onto `ctx` at `atSeconds` (context time). */
export function scheduleSfx(ctx: BaseAudioContext, destination: AudioNode, sound: SfxSound, atSeconds: number, volume = 1): void {
  scheduleNotes(ctx, destination, sfxEvents(sound), atSeconds, volume)
}

/** Play one effect once, now, through a shared AudioContext — the "preview" button. */
let previewCtx: AudioContext | null = null
export function previewSfx(sound: SfxSound, volume = 1): void {
  if (typeof AudioContext === 'undefined') return
  previewCtx ??= new AudioContext()
  void previewCtx.resume()
  scheduleSfx(previewCtx, previewCtx.destination, sound, previewCtx.currentTime + 0.02, volume)
}
