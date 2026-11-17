/**
 * Admin → Creatives → video projects (Creatives v2): a project, its scenes,
 * the client-owned timeline document and the shared audio library. Shapes
 * follow the API contract exactly (`/admin/creatives/videos*`,
 * `/admin/creatives/audio*`); nothing here is derived.
 */

import type { CreativeAgentJob, CreativeGeneration, CreativePlatform } from './creatives'

export type VideoAspect = '9:16' | '16:9' | '1:1'

/** Kling = silent and cheaper; Seedance = with its own sound. */
export type SceneEngine = 'kling' | 'seedance'

export type SceneKind = 'clip' | 'template'

export type SceneStatus = 'empty' | 'planned' | 'generating' | 'ready' | 'failed' | 'expired'

export type TemplateKey =
  | 'pixel-title'
  | 'pixel-scoreboard'
  | 'pixel-levelup'
  | 'clean-title'
  | 'clean-stat'
  | 'disclaimer'

export type CaptionStyle = 'clean' | 'bold' | 'pixel'

export type MusicPreset = 'arcade-upbeat' | 'arcade-chill' | 'arcade-boss' | 'arcade-victory'

export type SfxSound = 'coin' | 'powerup' | 'blip' | 'levelup' | 'select'

export type PixelDefault = 'none' | 'cameo' | 'lead'

export type AudioKind = 'music' | 'voiceover'

/** What a template card prints. Empty strings are allowed; the card leaves that line out. */
export interface TemplateFields {
  key: TemplateKey
  title: string
  value: string
  subtitle: string
}

export interface CreativeVideoScene {
  id: number
  position: number
  kind: SceneKind
  label: string
  prompt: string | null
  engine: SceneEngine | null
  engine_label: string | null
  with_character: boolean
  /** The clip's full length as made (or a template card's length). */
  seconds: number
  template: TemplateFields | null
  /** The clip, in the Gallery's shape (`outputs[].url` + `download_path`). */
  generation: CreativeGeneration | null
  output_index: number
  agent_job_id: number | null
  step_index: number | null
  trim_in_ms: number | null
  trim_out_ms: number | null
  /** (trim_out ?? seconds·1000) − (trim_in ?? 0). */
  duration_ms: number
  status: SceneStatus
  error: string | null
  /** While a job makes this scene: where it is and how long it usually takes. */
  progress?: SceneProgress | null
}

export interface SceneProgress {
  /** When the scene's first step started (ISO). */
  started_at: string | null
  /** 1-based step of `steps` (a Kling scene: 1 = still image, 2 = animation). */
  step: number
  steps: number
  step_label: string
  /** The current step has not started yet (waiting for a free slot or its still). */
  waiting: boolean
  /** Median of our own finished runs of these models; null until there are enough. */
  typical_seconds: number | null
}

export type AttemptStatus = 'made' | 'running' | 'waiting' | 'failed' | 'canceled' | 'skipped'

/** One step of one job for this video: the editor's History. */
export interface SceneAttempt {
  id: string
  job_id: number
  job_title: string
  step_index: number
  scene_id: number | null
  scene_label: string | null
  /** null = the scene has since been removed. */
  scene_position: number | null
  /** Still image | Animation | Image | Clip */
  role: string
  model: string
  model_label: string
  status: AttemptStatus
  error: string | null
  started_at: string | null
  ended_at: string | null
  seconds: number | null
  usd: number
  started_by: string | null
  approved_by: string | null
  generation_id: number | null
}

/* ---------- the timeline document (client-owned JSON) ---------- */

export type CaptionRole = 'hook' | 'body' | 'disclaimer'
export type CaptionPosition = 'top' | 'middle' | 'bottom'

export interface TimelineCaption {
  id: string
  text: string
  start_ms: number
  end_ms: number
  style: CaptionRole
  position: CaptionPosition
}

/** 0 = off. */
export type PixelSize = 0 | 6 | 10 | 16

export interface TimelineLook {
  pixel_size: PixelSize
  scanlines: boolean
}

export type TimelineMusic =
  | { source: 'chiptune'; preset: MusicPreset; seed: number; volume: number; fade_out_ms: number }
  | { source: 'asset'; asset_id: number; volume: number; start_ms: number; fade_out_ms: number }

export interface TimelineVoiceover {
  asset_id: number
  volume: number
  start_ms: number
}

export interface TimelineSfx {
  id: string
  sound: SfxSound
  at_ms: number
  volume: number
}

export interface TimelineDoc {
  version: 1
  caption_style: CaptionStyle
  captions: TimelineCaption[]
  look: TimelineLook
  music: TimelineMusic | null
  voiceover: TimelineVoiceover | null
  sfx: TimelineSfx[]
  /** Seedance clips' own sound, 0–1. */
  clip_audio_volume: number
  ducking: { enabled: boolean; music_under_voice: number }
}

/* ---------- projects ---------- */

export interface CreativeVideoStyleRef {
  id: number
  slug: string
  name: string
}

/** A job born in the editor: the agent job shape plus the video it fills. */
export type CreativeVideoJob = CreativeAgentJob

export interface CreativeVideo {
  id: number
  title: string
  plan_id: number | null
  plan_title: string | null
  style: CreativeVideoStyleRef | null
  platform: CreativePlatform
  aspect: VideoAspect
  max_seconds: number
  fps: number
  timeline: TimelineDoc
  status: 'draft' | 'exported'
  exported_at: string | null
  exported_by_name: string | null
  export_seconds: number | null
  export_bytes: number | null
  created_by_name: string | null
  updated_by_name: string | null
  created_at: string
  updated_at: string
  duration_ms: number
  scenes: CreativeVideoScene[]
  jobs: CreativeVideoJob[]
}

export interface CreativeVideoSummary {
  id: number
  title: string
  platform: CreativePlatform
  aspect: VideoAspect
  style_name: string | null
  status: 'draft' | 'exported'
  scenes_total: number
  scenes_ready: number
  scenes_generating: number
  /** Who pressed Go on the job making clips right now (the team is told, never blocked). */
  generating_by?: string | null
  duration_ms: number
  created_by_name: string | null
  updated_at: string
}

export interface CreativeVideoInput {
  title: string
  platform: CreativePlatform
  aspect: VideoAspect
  style_id?: number
  plan_id?: number
}

/** The client-owned columns of one scene, for PUT. */
export interface CreativeVideoScenePatch {
  id: number
  position?: number
  label?: string
  trim_in_ms?: number | null
  trim_out_ms?: number | null
  template?: TemplateFields | null
}

export interface CreativeVideoPatch {
  title?: string
  style_id?: number | null
  platform?: CreativePlatform
  aspect?: VideoAspect
  timeline?: TimelineDoc
  scenes?: CreativeVideoScenePatch[]
}

export type CreativeVideoSceneInput =
  | { kind: 'clip'; generation_id: number; output_index: number; position?: number }
  | { kind: 'template'; template: TemplateFields; seconds: number; position?: number }

/** One scene the editor (or the agent) asks Higgsfield for — or a free template card. */
export interface SceneDraft {
  kind: SceneKind
  label: string
  prompt: string
  seconds: number
  engine: SceneEngine | null
  with_character: boolean
  caption: string | null
  template: TemplateFields | null
}

export interface ProposeScenesResult {
  /** null when every draft was a free template card (nothing to make). */
  job: CreativeAgentJob | null
  video: CreativeVideo
}

/* ---------- the audio library ---------- */

export interface CreativeAudioAsset {
  id: number
  kind: AudioKind
  label: string
  mime: string
  bytes: number
  duration_ms: number | null
  /** Signed RELATIVE path, valid 2 h — prefix with `signedUrl()`. */
  url: string
  created_by_name: string | null
  created_at: string
}
