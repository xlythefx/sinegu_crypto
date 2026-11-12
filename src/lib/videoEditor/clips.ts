/**
 * Getting the media an export needs into the browser:
 * - a clip's MP4 as a Blob — first straight from Higgsfield's CDN (its bucket
 *   answers `Access-Control-Allow-Origin: *`), and when that fails, through
 *   our own signed download link, refreshed first when it is older than its
 *   30 minutes (`DOWNLOAD_FRESH_MS`);
 * - an audio file from the library, decoded to an AudioBuffer.
 * Both are cached in memory for the page's life, so a second export (or the
 * preview's mix) fetches nothing again.
 */

import { DOWNLOAD_FRESH_MS, signedUrl } from '../creatives'
import type { CreativeGeneration } from '../../types/creatives'
import type { CreativeAudioAsset } from '../../types/creativeVideos'

const clipCache = new Map<string, Blob>()
const audioCache = new Map<number, Promise<AudioBuffer>>()

export interface ClipFetchOptions {
  /** When the generation (and so its download path) was last read. */
  readAt: number
  /** Re-read one generation for a fresh signed path (services/creatives `getCreativeGeneration`). */
  refresh: (generationId: number) => Promise<CreativeGeneration | null>
  signal?: AbortSignal
}

export class ClipUnavailableError extends Error {}

async function fetchBlob(url: string, signal?: AbortSignal): Promise<Blob> {
  const res = await fetch(url, { signal, credentials: 'omit' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  if (blob.size === 0) throw new Error('empty')
  return blob
}

/** One clip's file. Throws ClipUnavailableError when Higgsfield no longer has it. */
export async function fetchClipBlob(g: CreativeGeneration, index: number, opts: ClipFetchOptions): Promise<Blob> {
  const key = `${g.id}:${index}`
  const hit = clipCache.get(key)
  if (hit) return hit

  const out = g.outputs[index]
  if (!out) throw new ClipUnavailableError('This clip is no longer available from Higgsfield.')

  // 1. The CDN, straight.
  try {
    const blob = await fetchBlob(out.url, opts.signal)
    clipCache.set(key, blob)
    return blob
  } catch (err) {
    if (opts.signal?.aborted) throw err
  }

  // 2. Our signed download (same origin as the API), re-read when it may have run out.
  let path: string | null = out.download_path ?? null
  if (!path || Date.now() - opts.readAt > DOWNLOAD_FRESH_MS) {
    const fresh = await opts.refresh(g.id)
    path = fresh?.outputs[index]?.download_path ?? null
  }
  if (!path) throw new ClipUnavailableError('This clip is no longer available from Higgsfield.')
  const res = await fetch(signedUrl(path), { signal: opts.signal })
  if (res.status === 410 || res.status === 404) throw new ClipUnavailableError('Higgsfield has deleted this clip.')
  if (!res.ok) throw new Error(`Could not download the clip (HTTP ${res.status}).`)
  const blob = await res.blob()
  clipCache.set(key, blob)
  return blob
}

let decodeCtx: OfflineAudioContext | null = null
function decoder(): OfflineAudioContext {
  // Any context decodes; a 1-frame offline one costs nothing and never plays.
  decodeCtx ??= new OfflineAudioContext(2, 1, 48_000)
  return decodeCtx
}

/** Decode any audio file the browser can read. */
export async function decodeAudio(data: ArrayBuffer): Promise<AudioBuffer> {
  return decoder().decodeAudioData(data)
}

/** A library file, decoded (cached per asset id; a failed load is forgotten so a retry tries again). */
export function loadAudioAsset(asset: Pick<CreativeAudioAsset, 'id' | 'url'>): Promise<AudioBuffer> {
  const hit = audioCache.get(asset.id)
  if (hit) return hit
  const p = (async () => {
    const res = await fetch(signedUrl(asset.url))
    if (!res.ok) throw new Error(`Could not load the audio (HTTP ${res.status}).`)
    return decodeAudio(await res.arrayBuffer())
  })()
  audioCache.set(asset.id, p)
  p.catch(() => audioCache.delete(asset.id))
  return p
}

/** How long an audio file is, measured in the browser (sent with the upload). Null when it cannot be read. */
export async function measureAudioMs(file: Blob): Promise<number | null> {
  try {
    const buf = await decodeAudio(await file.arrayBuffer())
    return Math.round(buf.duration * 1000)
  } catch {
    return null
  }
}
