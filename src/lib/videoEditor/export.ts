/**
 * Export orchestrator — the main-thread half of "Export MP4":
 * 1. fetch every clip's file (CDN first, our signed download as the fallback);
 * 2. decode the library audio and each clip's own sound for its trimmed span,
 *    and mix the soundtrack (OfflineAudioContext — main thread only);
 * 3. hand everything to the encoder worker and report its progress;
 * 4. return the MP4 as a Blob (the page downloads it and records the export).
 * Loaded only when Export is pressed (mediabunny and the worker with it).
 */

import { ALL_FORMATS, AudioBufferSink, BlobSource, Input } from 'mediabunny'
import type { CreativeGeneration } from '../../types/creatives'
import type { CreativeAudioAsset, CreativeVideo } from '../../types/creativeVideos'
import { exportSize } from '../creativeVideos'
import { hasSoundtrack, mixTimeline, MIX_SAMPLE_RATE, toPlanar, type ClipAudio } from './audioMix'
import { fetchClipBlob, loadAudioAsset } from './clips'
import type { ExportJob, ExportScene, ExportWorkerMessage } from './exportProtocol'
import { sceneSpans, totalMs } from './timeline'

export type ExportPhase = 'clips' | 'audio' | 'encoding' | 'done'

export interface ExportProgress {
  phase: ExportPhase
  done: number
  total: number
}

export interface ExportOptions {
  video: CreativeVideo
  /** When the video (so its clips' signed paths) was last read. */
  readAt: number
  refresh: (generationId: number) => Promise<CreativeGeneration | null>
  audioAssets: CreativeAudioAsset[]
  /** The H.264 codec string the support check accepted. */
  codec: string
  onProgress: (p: ExportProgress) => void
  signal?: AbortSignal
}

export interface ExportResult {
  blob: Blob
  /** The video's length. */
  seconds: number
  bytes: number
}

export const VIDEO_BITRATE = 8_000_000
export const AUDIO_BITRATE = 128_000

const aborted = () => new DOMException('The export was cancelled.', 'AbortError')

/** A clip's own sound between `inMs` and `outMs`, as one AudioBuffer — or null when it has none. */
export async function decodeClipAudio(blob: Blob, inMs: number, outMs: number): Promise<AudioBuffer | null> {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS })
  try {
    const track = await input.getPrimaryAudioTrack()
    if (!track || !(await track.canDecode())) return null
    const first = await track.getFirstTimestamp()
    const from = first + inMs / 1000
    const to = first + outMs / 1000
    const sr = track.sampleRate
    const channels = Math.max(1, Math.min(2, track.numberOfChannels))
    const length = Math.max(1, Math.ceil((to - from) * sr))
    const out = new AudioBuffer({ length, numberOfChannels: channels, sampleRate: sr })
    const sink = new AudioBufferSink(track)
    for await (const { buffer, timestamp } of sink.buffers(from, to)) {
      const offset = Math.round((timestamp - from) * sr)
      for (let c = 0; c < channels; c++) {
        const src = buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1))
        const start = Math.max(0, -offset)
        const end = Math.min(src.length, length - offset)
        if (end > start) out.getChannelData(c).set(src.subarray(start, end), offset + start)
      }
    }
    return out
  } finally {
    input.dispose()
  }
}

export async function exportVideo(opts: ExportOptions): Promise<ExportResult> {
  const { video, signal } = opts
  const spans = sceneSpans(video.scenes)
  const byId = new Map(video.scenes.map((s) => [s.id, s]))
  const total = totalMs(video.scenes)
  const clipSpans = spans.filter((sp) => byId.get(sp.id)?.kind === 'clip')

  // 1. The clips' files.
  const blobs = new Map<number, Blob>()
  opts.onProgress({ phase: 'clips', done: 0, total: clipSpans.length })
  for (const [i, sp] of clipSpans.entries()) {
    if (signal?.aborted) throw aborted()
    const scene = byId.get(sp.id)
    if (!scene?.generation) throw new Error(`Scene ${sp.index + 1} has no clip yet.`)
    blobs.set(sp.id, await fetchClipBlob(scene.generation, scene.output_index, { readAt: opts.readAt, refresh: opts.refresh, signal }))
    opts.onProgress({ phase: 'clips', done: i + 1, total: clipSpans.length })
  }

  // 2. The soundtrack.
  opts.onProgress({ phase: 'audio', done: 0, total: 1 })
  const tl = video.timeline
  const asset = (id: number) => opts.audioAssets.find((a) => a.id === id)
  const musicAsset = tl.music?.source === 'asset' ? asset(tl.music.asset_id) : undefined
  const voiceAsset = tl.voiceover ? asset(tl.voiceover.asset_id) : undefined
  const [musicBuffer, voiceBuffer] = await Promise.all([
    musicAsset ? loadAudioAsset(musicAsset) : Promise.resolve(null),
    voiceAsset ? loadAudioAsset(voiceAsset) : Promise.resolve(null),
  ])
  const clips: ClipAudio[] = []
  if (tl.clip_audio_volume > 0) {
    for (const sp of clipSpans) {
      if (signal?.aborted) throw aborted()
      const blob = blobs.get(sp.id)
      const buf = blob ? await decodeClipAudio(blob, sp.in_ms, sp.out_ms).catch(() => null) : null
      if (buf) clips.push({ startMs: sp.start_ms, buffer: buf })
    }
  }
  let audio: ExportJob['audio'] = null
  if (hasSoundtrack(tl) || clips.length > 0) {
    const mix = await mixTimeline({ durationMs: total, timeline: tl, musicBuffer, voiceBuffer, clips, sampleRate: MIX_SAMPLE_RATE })
    audio = { sampleRate: mix.sampleRate, channels: toPlanar(mix) }
  }
  opts.onProgress({ phase: 'audio', done: 1, total: 1 })
  if (signal?.aborted) throw aborted()

  // 3. Encode in the worker.
  const { width, height } = exportSize(video.aspect)
  const scenes: ExportScene[] = spans.map((sp) => {
    const s = byId.get(sp.id)
    return {
      kind: s?.kind === 'template' ? 'template' : 'clip',
      start_ms: sp.start_ms,
      end_ms: sp.end_ms,
      in_ms: sp.in_ms,
      out_ms: sp.out_ms,
      blob: blobs.get(sp.id),
      template: s?.template ?? undefined,
    }
  })
  const job: ExportJob = {
    width,
    height,
    fps: video.fps || 30,
    codec: opts.codec,
    videoBitrate: VIDEO_BITRATE,
    totalMs: total,
    scenes,
    captions: tl.captions,
    captionStyle: tl.caption_style,
    look: tl.look,
    audio,
    audioBitrate: AUDIO_BITRATE,
  }

  const worker = new Worker(new URL('../../workers/videoExport.worker.ts', import.meta.url), { type: 'module' })
  try {
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const onAbort = () => reject(aborted())
      signal?.addEventListener('abort', onAbort, { once: true })
      worker.onerror = (e) => reject(new Error(e.message || 'The encoder stopped unexpectedly.'))
      worker.onmessage = (e: MessageEvent<ExportWorkerMessage>) => {
        const m = e.data
        if (m.type === 'progress') opts.onProgress({ phase: 'encoding', done: m.frame, total: m.frames })
        else if (m.type === 'done') resolve(m.buffer)
        else reject(new Error(m.message))
      }
      worker.postMessage(job, audio ? audio.channels.map((c) => c.buffer as ArrayBuffer) : [])
    })
    const blob = new Blob([buffer], { type: 'video/mp4' })
    opts.onProgress({ phase: 'done', done: 1, total: 1 })
    return { blob, seconds: Math.round(total / 10) / 100, bytes: blob.size }
  } finally {
    worker.terminate()
  }
}

/** Save a Blob as a file, through an object URL. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function exportFilename(id: number): string {
  return `pixel-alpha-video-${id}.mp4`
}
