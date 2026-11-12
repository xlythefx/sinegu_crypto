import { apiFetch } from './api'
import type { AudioKind, CreativeAudioAsset } from '../types/creativeVideos'

/**
 * Admin → Creatives → the shared audio library: music and voiceovers the team
 * uploads or records (≤ 15 MB each, ≤ 40 in all). The one thing Creatives
 * stores on our server besides Pixel's reference images. Each file is read
 * through a signed link valid 2 h.
 */

type Ok<T> = { success: boolean } & T

const normalise = (a: CreativeAudioAsset): CreativeAudioAsset => ({
  ...a,
  bytes: Number(a.bytes) || 0,
  duration_ms: a.duration_ms === null || a.duration_ms === undefined ? null : Number(a.duration_ms) || 0,
})

export async function getCreativeAudio(): Promise<CreativeAudioAsset[]> {
  const { audio } = await apiFetch<Ok<{ audio: CreativeAudioAsset[] }>>('/admin/creatives/audio', { auth: true })
  return (audio ?? []).map(normalise)
}

/** 422 AUDIO_LIBRARY_FULL at 40 files. `durationMs` is measured in the browser before the upload. */
export async function uploadCreativeAudio(
  file: Blob,
  input: { kind: AudioKind; label: string; durationMs?: number | null; filename?: string },
): Promise<CreativeAudioAsset> {
  const form = new FormData()
  form.append('file', file, input.filename ?? (file instanceof File ? file.name : 'audio'))
  form.append('kind', input.kind)
  form.append('label', input.label)
  if (input.durationMs && input.durationMs > 0) form.append('duration_ms', String(Math.round(input.durationMs)))
  const { asset } = await apiFetch<Ok<{ asset: CreativeAudioAsset }>>('/admin/creatives/audio', {
    method: 'POST',
    auth: true,
    body: form,
  })
  return normalise(asset)
}

/** 409 AUDIO_IN_USE while a video project's music or voiceover uses it. */
export async function deleteCreativeAudio(id: number): Promise<void> {
  await apiFetch<Ok<object>>(`/admin/creatives/audio/${id}`, { method: 'DELETE', auth: true })
}
