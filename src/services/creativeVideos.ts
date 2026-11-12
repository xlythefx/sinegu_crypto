import { apiFetch } from './api'
import { normaliseJob } from './creativesAgent'
import type {
  CreativeVideo,
  CreativeVideoInput,
  CreativeVideoPatch,
  CreativeVideoSceneInput,
  CreativeVideoSummary,
  ProposeScenesResult,
  SceneDraft,
  TimelineDoc,
} from '../types/creativeVideos'

/**
 * Admin → Creatives → video projects (Creatives v2). Same staff group as the
 * rest of Creatives, so collaborators (the marketing team) write here too.
 * The SERVER owns a scene's generation, job and status; the client owns its
 * position, label, trims and template, plus the whole timeline document.
 * Nothing here spends money: proposing scenes only prices them, and the job's
 * own Go (`approveAgentJob`) is what starts Higgsfield.
 */

type Ok<T> = { success: boolean } & T

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

const numOrNull = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : num(v))

/** What an older or partial row still needs to render. */
export function defaultTimeline(): TimelineDoc {
  return {
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
}

function normaliseTimeline(raw: Partial<TimelineDoc> | null | undefined): TimelineDoc {
  const base = defaultTimeline()
  if (!raw || typeof raw !== 'object') return base
  return {
    ...base,
    ...raw,
    version: 1,
    captions: Array.isArray(raw.captions) ? raw.captions : [],
    look: { ...base.look, ...(raw.look ?? {}) },
    sfx: Array.isArray(raw.sfx) ? raw.sfx : [],
    ducking: { ...base.ducking, ...(raw.ducking ?? {}) },
    clip_audio_volume: num(raw.clip_audio_volume, 1),
  }
}

export function normaliseVideo(v: CreativeVideo): CreativeVideo {
  return {
    ...v,
    max_seconds: num(v.max_seconds, 30),
    fps: num(v.fps, 30),
    duration_ms: num(v.duration_ms),
    export_seconds: numOrNull(v.export_seconds),
    export_bytes: numOrNull(v.export_bytes),
    timeline: normaliseTimeline(v.timeline),
    scenes: (v.scenes ?? [])
      .map((s) => ({
        ...s,
        seconds: num(s.seconds),
        duration_ms: num(s.duration_ms, num(s.seconds) * 1000),
        trim_in_ms: numOrNull(s.trim_in_ms),
        trim_out_ms: numOrNull(s.trim_out_ms),
        generation: s.generation ? { ...s.generation, outputs: s.generation.outputs ?? [] } : null,
      }))
      .sort((a, b) => a.position - b.position),
    jobs: (v.jobs ?? []).map(normaliseJob),
  }
}

/** Newest first. */
export async function getCreativeVideos(limit = 20): Promise<CreativeVideoSummary[]> {
  const { videos } = await apiFetch<Ok<{ videos: CreativeVideoSummary[] }>>(
    `/admin/creatives/videos?limit=${limit}`,
    { auth: true },
  )
  return (videos ?? []).map((v) => ({ ...v, duration_ms: num(v.duration_ms) }))
}

/** The timeline is seeded from the style (caption style, chiptune, Pixel look). */
export async function createCreativeVideo(input: CreativeVideoInput): Promise<CreativeVideo> {
  const { video } = await apiFetch<Ok<{ video: CreativeVideo }>>('/admin/creatives/videos', {
    method: 'POST',
    auth: true,
    body: input,
  })
  return normaliseVideo(video)
}

/** Also moves this video's running jobs on and refreshes its pending clips (throttled server-side). */
export async function getCreativeVideo(id: number): Promise<CreativeVideo> {
  const { video } = await apiFetch<Ok<{ video: CreativeVideo }>>(`/admin/creatives/videos/${id}`, { auth: true })
  return normaliseVideo(video)
}

/**
 * Client-owned fields only. 409 ASPECT_LOCKED when the shape changes after a
 * clip was made; 422 TOO_LONG past `max_seconds`.
 */
export async function updateCreativeVideo(id: number, patch: CreativeVideoPatch): Promise<CreativeVideo> {
  const { video } = await apiFetch<Ok<{ video: CreativeVideo }>>(`/admin/creatives/videos/${id}`, {
    method: 'PUT',
    auth: true,
    body: patch,
  })
  return normaliseVideo(video)
}

/** A finished clip from the Gallery, or a free template card. */
export async function addCreativeVideoScene(id: number, input: CreativeVideoSceneInput): Promise<CreativeVideo> {
  const { video } = await apiFetch<Ok<{ video: CreativeVideo }>>(`/admin/creatives/videos/${id}/scenes`, {
    method: 'POST',
    auth: true,
    body: input,
  })
  return normaliseVideo(video)
}

export async function deleteCreativeVideoScene(id: number, sceneId: number): Promise<CreativeVideo> {
  const { video } = await apiFetch<Ok<{ video: CreativeVideo }>>(`/admin/creatives/videos/${id}/scenes/${sceneId}`, {
    method: 'DELETE',
    auth: true,
  })
  return normaliseVideo(video)
}

/** The project and its scenes; the clips themselves stay in the Gallery. */
export async function deleteCreativeVideo(id: number): Promise<void> {
  await apiFetch<Ok<object>>(`/admin/creatives/videos/${id}`, { method: 'DELETE', auth: true })
}

/** Export metadata only — the MP4 itself never leaves the browser. */
export async function markCreativeVideoExported(
  id: number,
  stats: { seconds: number; bytes: number },
): Promise<CreativeVideo> {
  const { video } = await apiFetch<Ok<{ video: CreativeVideo }>>(`/admin/creatives/videos/${id}/exported`, {
    method: 'POST',
    auth: true,
    body: stats,
  })
  return normaliseVideo(video)
}

/**
 * Prices the scenes and adds `planned` slots (or re-plans `replaceSceneId`).
 * Spends NOTHING — the returned job starts only on its Go.
 */
export async function proposeCreativeVideoScenes(
  id: number,
  scenes: SceneDraft[],
  replaceSceneId?: number,
): Promise<ProposeScenesResult> {
  const { job, video } = await apiFetch<Ok<ProposeScenesResult>>(`/admin/creatives/videos/${id}/scenes/propose`, {
    method: 'POST',
    auth: true,
    body: { scenes, ...(replaceSceneId ? { replace_scene_id: replaceSceneId } : {}) },
  })
  return { job: job ? normaliseJob(job) : null, video: normaliseVideo(video) }
}
