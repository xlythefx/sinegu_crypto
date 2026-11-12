/**
 * Pure helpers for Admin → Creatives → video projects: labels, the engine and
 * template rules (seconds per engine, export sizes), the editor path and the
 * error sentences. No React. The rules here are the CLIENT twin of the API's
 * — the server checks them again.
 */

import { ApiError } from '../services/api'
import { creativeErrorMessage, isExpiredGeneration, msUntilExpiry, type CreativeTone } from './creatives'
import type {
  CaptionRole,
  CreativeVideoScene,
  CaptionStyle,
  MusicPreset,
  PixelSize,
  SceneEngine,
  SceneStatus,
  SfxSound,
  TemplateFields,
  TemplateKey,
  VideoAspect,
} from '../types/creativeVideos'

/** The line a video gets whenever it cites a percentage. */
import { DISCLAIMER_TEXT } from './videoEditor/disclaimer'

export { DISCLAIMER_TEXT }

/** The editor's path for one project. */
export function editorPath(id: number): string {
  return `/admin/creatives/editor/${id}`
}

/* ---------- shapes ---------- */

export interface AspectMeta {
  key: VideoAspect
  label: string
  hint: string
  width: number
  height: number
}

export const ASPECTS: readonly AspectMeta[] = [
  { key: '9:16', label: '9:16', hint: 'Tall — TikTok, Reels, Shorts', width: 1080, height: 1920 },
  { key: '16:9', label: '16:9', hint: 'Wide — X, YouTube', width: 1920, height: 1080 },
  { key: '1:1', label: '1:1', hint: 'Square — X, Instagram feed', width: 1080, height: 1080 },
]

export function aspectMeta(aspect: VideoAspect): AspectMeta {
  return ASPECTS.find((a) => a.key === aspect) ?? ASPECTS[0]
}

/** The MP4's size in pixels. */
export function exportSize(aspect: VideoAspect): { width: number; height: number } {
  const a = aspectMeta(aspect)
  return { width: a.width, height: a.height }
}

/** "9 / 16" — for CSS `aspect-ratio`. */
export function cssAspect(aspect: VideoAspect): string {
  const { width, height } = exportSize(aspect)
  return `${width} / ${height}`
}

/* ---------- engines + seconds ---------- */

export interface EngineMeta {
  key: SceneEngine
  label: string
  /** One line for the picker. */
  hint: string
  /** The lengths it can make. */
  seconds: readonly number[]
  sound: boolean
}

export const ENGINES: readonly EngineMeta[] = [
  {
    key: 'kling',
    label: 'Kling',
    hint: 'Silent and cheaper — the music, voiceover and sound effects carry it',
    seconds: [5, 10],
    sound: false,
  },
  {
    key: 'seedance',
    label: 'Seedance',
    hint: 'Comes with its own sound — dialogue, effects, chiptune',
    seconds: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    sound: true,
  },
]

export function engineMeta(engine: SceneEngine): EngineMeta {
  return ENGINES.find((e) => e.key === engine) ?? ENGINES[0]
}

/** A template card lasts 2–6 s. */
export const TEMPLATE_SECONDS: readonly number[] = [2, 3, 4, 5, 6]

/** The nearest length the engine (or a template card) can make. */
export function clampSceneSeconds(kind: 'clip' | 'template', engine: SceneEngine | null, seconds: number): number {
  const allowed = kind === 'template' ? TEMPLATE_SECONDS : engineMeta(engine ?? 'kling').seconds
  let best = allowed[0]
  for (const s of allowed) if (Math.abs(s - seconds) < Math.abs(best - seconds)) best = s
  return best
}

/* ---------- scene status ---------- */

/** The clip a scene plays, while Higgsfield still has it (null for a card, or once deleted). */
export function clipUrl(scene: CreativeVideoScene, now: number): string | null {
  const g = scene.generation
  if (scene.kind !== 'clip' || !g || scene.status === 'expired' || isExpiredGeneration(g, now)) return null
  return g.outputs[scene.output_index]?.url ?? g.outputs[0]?.url ?? null
}

/** A clip scene whose file Higgsfield has deleted (or will have by `now`). */
export function isSceneExpired(scene: CreativeVideoScene, now: number): boolean {
  if (scene.kind !== 'clip') return false
  if (scene.status === 'expired') return true
  return !!scene.generation && isExpiredGeneration(scene.generation, now)
}

/** The soonest a clip on this video is deleted by Higgsfield, ms from now (null = none). */
export function soonestExpiryMs(scenes: readonly CreativeVideoScene[], now: number): number | null {
  let best: number | null = null
  for (const s of scenes) {
    if (s.kind !== 'clip' || !s.generation) continue
    const left = msUntilExpiry(s.generation, now)
    if (left !== null && left > 0 && (best === null || left < best)) best = left
  }
  return best
}

export const SCENE_STATUS: Record<SceneStatus, { label: string; tone: CreativeTone }> = {
  empty: { label: 'Empty', tone: 'muted' },
  planned: { label: 'Waiting for Go', tone: 'accent' },
  generating: { label: 'Making it', tone: 'accent' },
  ready: { label: 'Ready', tone: 'green' },
  failed: { label: 'Failed', tone: 'red' },
  expired: { label: 'Deleted by Higgsfield', tone: 'red' },
}

export function sceneStatusMeta(status: string): { label: string; tone: CreativeTone } {
  return SCENE_STATUS[status as SceneStatus] ?? { label: status, tone: 'muted' }
}

/* ---------- template cards ---------- */

export interface TemplateMeta {
  key: TemplateKey
  label: string
  family: 'pixel' | 'clean'
  hint: string
  /** Which fields the card prints, with the box's label and a placeholder. */
  fields: Array<{ name: 'title' | 'value' | 'subtitle'; label: string; placeholder: string }>
  defaults: Omit<TemplateFields, 'key'>
}

export const TEMPLATES: readonly TemplateMeta[] = [
  {
    key: 'pixel-title',
    label: 'Pixel title card',
    family: 'pixel',
    hint: 'A big 8-bit title, like an arcade start screen',
    fields: [
      { name: 'title', label: 'Title', placeholder: 'WEEK 46' },
      { name: 'subtitle', label: 'Under it', placeholder: 'PRESS START' },
    ],
    defaults: { title: 'WEEK RECAP', value: '', subtitle: 'PRESS START' },
  },
  {
    key: 'pixel-scoreboard',
    label: 'Pixel scoreboard',
    family: 'pixel',
    hint: 'A "HIGH SCORE" board for one exact figure',
    fields: [
      { name: 'title', label: 'Heading', placeholder: 'HIGH SCORE' },
      { name: 'value', label: 'The figure', placeholder: '+3.1%' },
      { name: 'subtitle', label: 'Under it', placeholder: 'THIS WEEK · 12 TRADES' },
    ],
    defaults: { title: 'HIGH SCORE', value: '+0.0%', subtitle: 'THIS WEEK' },
  },
  {
    key: 'pixel-levelup',
    label: 'Pixel level up',
    family: 'pixel',
    hint: 'A "LEVEL UP!" burst',
    fields: [
      { name: 'title', label: 'Headline', placeholder: 'LEVEL UP!' },
      { name: 'subtitle', label: 'Under it', placeholder: 'NEW BEST WEEK' },
    ],
    defaults: { title: 'LEVEL UP!', value: '', subtitle: '' },
  },
  {
    key: 'clean-title',
    label: 'Clean title card',
    family: 'clean',
    hint: 'A calm headline on the brand colours',
    fields: [
      { name: 'title', label: 'Title', placeholder: 'This week with Pixel Alpha' },
      { name: 'subtitle', label: 'Under it', placeholder: 'Every trade, verified' },
    ],
    defaults: { title: 'This week with Pixel Alpha', value: '', subtitle: '' },
  },
  {
    key: 'clean-stat',
    label: 'Clean stat card',
    family: 'clean',
    hint: 'One big figure with a label',
    fields: [
      { name: 'title', label: 'Label', placeholder: 'This week' },
      { name: 'value', label: 'The figure', placeholder: '+3.1%' },
      { name: 'subtitle', label: 'Under it', placeholder: '12 trades · LTC the best coin' },
    ],
    defaults: { title: 'This week', value: '+0.0%', subtitle: '' },
  },
  {
    key: 'disclaimer',
    label: 'Disclaimer card',
    family: 'clean',
    hint: 'The closing line any video with a % needs',
    fields: [{ name: 'title', label: 'Text', placeholder: DISCLAIMER_TEXT }],
    defaults: { title: DISCLAIMER_TEXT, value: '', subtitle: '' },
  },
]

export function templateMeta(key: TemplateKey): TemplateMeta {
  return TEMPLATES.find((t) => t.key === key) ?? TEMPLATES[0]
}

export function newTemplateFields(key: TemplateKey): TemplateFields {
  return { key, ...templateMeta(key).defaults }
}

/* ---------- captions, music, sound effects, look ---------- */

export const CAPTION_STYLES: ReadonlyArray<{ key: CaptionStyle; label: string; hint: string }> = [
  { key: 'clean', label: 'Clean', hint: 'White, with a soft shadow' },
  { key: 'bold', label: 'Bold', hint: 'Heavy white on a dark band' },
  { key: 'pixel', label: 'Pixel', hint: '8-bit arcade lettering' },
]

export const CAPTION_ROLES: ReadonlyArray<{ key: CaptionRole; label: string }> = [
  { key: 'hook', label: 'Hook' },
  { key: 'body', label: 'Body' },
  { key: 'disclaimer', label: 'Disclaimer' },
]

export const MUSIC_PRESETS: ReadonlyArray<{ key: MusicPreset; label: string; hint: string }> = [
  { key: 'arcade-upbeat', label: 'Arcade upbeat', hint: 'Bright and quick' },
  { key: 'arcade-chill', label: 'Arcade chill', hint: 'Slow and warm' },
  { key: 'arcade-boss', label: 'Arcade boss', hint: 'Driving and tense' },
  { key: 'arcade-victory', label: 'Arcade victory', hint: 'Triumphant fanfare' },
]

export const SFX_SOUNDS: ReadonlyArray<{ key: SfxSound; label: string }> = [
  { key: 'coin', label: 'Coin' },
  { key: 'powerup', label: 'Power-up' },
  { key: 'blip', label: 'Blip' },
  { key: 'levelup', label: 'Level up' },
  { key: 'select', label: 'Select' },
]

export const PIXEL_SIZES: ReadonlyArray<{ value: PixelSize; label: string }> = [
  { value: 0, label: 'Off' },
  { value: 6, label: 'Fine' },
  { value: 10, label: 'Chunky' },
  { value: 16, label: 'Blocky' },
]

/** "12.5 s" / "0:24" for the ruler. */
export function fmtSeconds(ms: number, digits = 1): string {
  return `${(Math.max(0, ms) / 1000).toFixed(digits).replace(/\.0+$/, '')} s`
}

export function fmtClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 100)) / 10
  const m = Math.floor(total / 60)
  const s = total - m * 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}

/** A short unique id for a caption or sound effect. */
export function localId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

/* ---------- errors ---------- */

export function videoErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    switch (err.errorCode) {
      case 'ASPECT_LOCKED':
        return 'The shape and platform are fixed once a clip has been made for this video — every clip is made in that shape.'
      case 'TOO_LONG':
        return 'That would make the video longer than 30 seconds. Trim a scene or remove one first.'
      case 'STYLE_IN_USE':
        return 'A video project still uses this style, so it can’t be deleted. Switch it off instead, or change those projects first.'
      case 'AUDIO_IN_USE':
        return 'A video project still uses this sound as its music or voiceover. Take it off that project first.'
      case 'AUDIO_LIBRARY_FULL':
        return 'The audio library is full (40 files). Delete one you no longer need first.'
      case 'CLIP_UNAVAILABLE':
      case 'NOT_A_VIDEO':
      case 'GENERATION_NOT_READY':
        return 'Only a finished video from the Gallery can be added as a scene, while Higgsfield still keeps it (7 days).'
    }
  }
  return creativeErrorMessage(err, fallback)
}
