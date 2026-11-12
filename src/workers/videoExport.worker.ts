/**
 * The MP4 encoder, in a Web Worker so the page stays responsive. Mediabunny
 * over WebCodecs: each clip is decoded straight to canvas frames at the
 * export size (cover-fit), template cards and captions are drawn with the
 * SAME code as the preview (lib/videoEditor/templates.ts + look.ts), and the
 * frames go to an H.264 encoder; the soundtrack the page mixed arrives as
 * planar Float32 and goes to AAC — natively, or through the AAC add-on
 * (loaded only when this browser has no AAC encoder). 30 fps, MP4 with the
 * index at the front so it plays as soon as it starts downloading.
 *
 * Typed against the DOM lib (the app's tsconfig); in a worker `self` is the
 * DedicatedWorkerGlobalScope, whose postMessage takes the same options.
 */

import {
  ALL_FORMATS,
  AudioSample,
  AudioSampleSource,
  BlobSource,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  canEncodeAudio,
} from 'mediabunny'
import type { ExportJob, ExportScene, ExportWorkerMessage } from '../lib/videoEditor/exportProtocol'
import { loadPixelFont } from '../lib/videoEditor/fonts'
import { LookRenderer, blockPx, drawScanlines } from '../lib/videoEditor/look'
import { drawCaptions, drawTemplate, usesPixelFont, type Ctx2D } from '../lib/videoEditor/templates'
import { captionsAt } from '../lib/videoEditor/timeline'

const post = (msg: ExportWorkerMessage, transfer: Transferable[] = []) => self.postMessage(msg, { transfer })

/** Feed this much audio per step, interleaved with the video, so neither track runs ahead. */
const AUDIO_CHUNK_S = 1

async function run(job: ExportJob): Promise<void> {
  const { width: w, height: h, fps } = job
  const frames = Math.max(1, Math.round((job.totalMs / 1000) * fps))

  // AAC: native when the browser has it, the add-on otherwise (loaded only then).
  if (job.audio && !(await canEncodeAudio('aac', { numberOfChannels: job.audio.channels.length, sampleRate: job.audio.sampleRate }))) {
    const { registerAacEncoder } = await import('@mediabunny/aac-encoder')
    registerAacEncoder()
  }

  if (usesPixelFont(job.scenes.map((s) => s.template?.key ?? ''), job.captionStyle)) {
    await loadPixelFont((self as unknown as { fonts?: FontFaceSet }).fonts)
  }

  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d', { alpha: false }) as Ctx2D | null
  if (!ctx) throw new Error('This browser cannot draw video frames off-screen.')

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget(),
  })
  const video = new CanvasSource(canvas, {
    codec: 'avc',
    quality: new Quality({ bitrate: job.videoBitrate }),
    keyFrameInterval: 2,
    fullCodecString: job.codec,
  })
  output.addVideoTrack(video, { frameRate: fps })

  let audio: AudioSampleSource | null = null
  if (job.audio) {
    audio = new AudioSampleSource({ codec: 'aac', quality: new Quality({ bitrate: job.audioBitrate }) })
    output.addAudioTrack(audio)
  }

  await output.start()

  // ---- audio, fed one second ahead of the video ----
  let audioFed = 0 // frames of audio already added
  const audioTotal = job.audio ? job.audio.channels[0]?.length ?? 0 : 0
  const feedAudioUntil = async (seconds: number) => {
    if (!audio || !job.audio) return
    const sr = job.audio.sampleRate
    const target = Math.min(audioTotal, Math.ceil(seconds * sr))
    while (audioFed < target) {
      const end = Math.min(target, audioFed + Math.round(AUDIO_CHUNK_S * sr))
      const n = end - audioFed
      const chans = job.audio.channels
      const data = new Float32Array(n * chans.length)
      chans.forEach((c, i) => data.set(c.subarray(audioFed, end), i * n))
      const sample = new AudioSample({
        data,
        format: 'f32-planar',
        numberOfChannels: chans.length,
        sampleRate: sr,
        timestamp: audioFed / sr,
      })
      await audio.add(sample)
      sample.close()
      audioFed = end
    }
  }

  // ---- video, scene by scene ----
  const look = new LookRenderer((cw, ch) => new OffscreenCanvas(cw, ch))
  const block = blockPx(job.look, w, h)
  let frame = 0

  const finishFrame = async (f: number) => {
    const t = f / fps
    if (job.look.scanlines) drawScanlines(ctx, w, h)
    drawCaptions(ctx, captionsAt(job.captions, t * 1000), job.captionStyle, w, h)
    await feedAudioUntil(t + AUDIO_CHUNK_S)
    await video.add(t, 1 / fps)
    if (f % 6 === 0) post({ type: 'progress', frame: f, frames })
  }

  const framesOf = (s: ExportScene): number[] => {
    const first = Math.ceil((s.start_ms / 1000) * fps - 1e-6)
    const last = Math.min(frames, Math.ceil((s.end_ms / 1000) * fps - 1e-6))
    const out: number[] = []
    for (let f = Math.max(first, frame); f < last; f++) out.push(f)
    return out
  }

  for (const scene of job.scenes) {
    const list = framesOf(scene)
    if (list.length === 0) continue

    if (scene.kind === 'template' && scene.template) {
      for (const f of list) {
        drawTemplate(ctx, scene.template, w, h, f / fps - scene.start_ms / 1000)
        await finishFrame(f)
      }
      frame = list[list.length - 1] + 1
      continue
    }

    if (!scene.blob) throw new Error('A clip is missing from the export.')
    const input = new Input({ source: new BlobSource(scene.blob), formats: ALL_FORMATS })
    try {
      const track = await input.getPrimaryVideoTrack()
      if (!track) throw new Error('One clip has no video in it.')
      const first = await track.getFirstTimestamp()
      const sink = new CanvasSink(track, { width: w, height: h, fit: 'cover', poolSize: 2 })
      const stamps = list.map((f) => first + scene.in_ms / 1000 + (f / fps - scene.start_ms / 1000))
      let i = 0
      let last: OffscreenCanvas | HTMLCanvasElement | null = null
      for await (const wrapped of sink.canvasesAtTimestamps(stamps)) {
        const f = list[i++]
        if (wrapped) last = wrapped.canvas
        if (last) {
          ctx.drawImage(last, 0, 0, w, h)
        } else {
          // Before the clip's first frame: black rather than the previous scene.
          ctx.fillStyle = '#000000'
          ctx.fillRect(0, 0, w, h)
        }
        if (block > 1) look.pixelate(ctx, w, h, block)
        await finishFrame(f)
      }
    } finally {
      input.dispose()
    }
    frame = list[list.length - 1] + 1
  }

  // A gap at the very end (rounding): hold black.
  while (frame < frames) {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, w, h)
    await finishFrame(frame++)
  }

  await feedAudioUntil(job.totalMs / 1000 + 1)
  video.close()
  audio?.close()
  await output.finalize()
  const buffer = (output.target as BufferTarget).buffer
  if (!buffer) throw new Error('The encoder produced no file.')
  post({ type: 'progress', frame: frames, frames })
  post({ type: 'done', buffer, mime: 'video/mp4' }, [buffer])
}

self.onmessage = (e: MessageEvent<ExportJob>) => {
  run(e.data).catch((err: unknown) => {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  })
}
