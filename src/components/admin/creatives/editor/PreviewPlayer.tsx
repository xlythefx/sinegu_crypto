import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { Clapperboard, ImageOff, LoaderCircle, Pause, Play, TriangleAlert } from 'lucide-react'
import { clipUrl, exportSize, fmtClock } from '../../../../lib/creativeVideos'
import { loadPixelFont } from '../../../../lib/videoEditor/fonts'
import { blockPx, drawCover, drawScanlines, LookRenderer } from '../../../../lib/videoEditor/look'
import { drawCaptions, drawTemplate, usesPixelFont, type Ctx2D } from '../../../../lib/videoEditor/templates'
import { captionsAt, sceneAt, type SceneSpan } from '../../../../lib/videoEditor/timeline'
import type { CreativeVideo, CreativeVideoScene } from '../../../../types/creativeVideos'
import { RANGE } from './editorClasses'

interface PreviewPlayerProps {
  video: CreativeVideo
  spans: SceneSpan[]
  totalMs: number
  timeRef: MutableRefObject<number>
  timeMs: number
  playing: boolean
  now: number
  onToggle: () => void
  onSeek: (ms: number) => void
}

/** What the screen shows when a scene has nothing to play yet. */
function placeholderFor(scene: CreativeVideoScene, now: number): { icon: 'wait' | 'gone' | 'fail'; text: string } | null {
  if (scene.kind === 'template') return null
  if (scene.status === 'planned') return { icon: 'wait', text: 'Waiting for its Go' }
  if (scene.status === 'generating') return { icon: 'wait', text: 'Higgsfield is making this scene…' }
  if (scene.status === 'failed') return { icon: 'fail', text: scene.error ? `This scene failed: ${scene.error}` : 'This scene failed.' }
  if (scene.status === 'expired' || !clipUrl(scene, now)) return { icon: 'gone', text: 'Deleted by Higgsfield — replace or regenerate it' }
  return null
}

/**
 * The preview: one <video> per clip, straight from Higgsfield's CDN, the one
 * at the playhead visible and kept in step with the editor's clock; template
 * cards and the Pixel look are drawn on a canvas above it with the export's
 * own drawing code, and the captions on a second canvas on top (so what is
 * seen is what is exported). Drawing a video onto a canvas for DISPLAY is
 * fine across origins — nothing is ever read back.
 */
export default function PreviewPlayer({ video, spans, totalMs, timeRef, timeMs, playing, now, onToggle, onSeek }: PreviewPlayerProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLCanvasElement>(null)
  const capRef = useRef<HTMLCanvasElement>(null)
  const videoEls = useRef(new Map<number, HTMLVideoElement>())
  const look = useMemo(() => new LookRenderer(), [])
  const fontReady = useRef(false)

  const scenesById = useMemo(() => new Map(video.scenes.map((s) => [s.id, s])), [video.scenes])
  const { width: ew, height: eh } = exportSize(video.aspect)
  const tl = video.timeline

  // The pixel font, before the first pixel card or caption is drawn.
  const needsFont = usesPixelFont(video.scenes.map((s) => s.template?.key ?? ''), tl.caption_style)
  useEffect(() => {
    if (!needsFont) return
    void loadPixelFont(document.fonts).then((ok) => {
      fontReady.current = ok
    })
  }, [needsFont])

  // Live props for the animation loop.
  const live = useRef({ spans, scenesById, tl, playing, totalMs })
  live.current = { spans, scenesById, tl, playing, totalMs }

  useEffect(() => {
    let raf = 0
    let capKey = ''
    const frame = () => {
      raf = requestAnimationFrame(frame)
      const box = boxRef.current
      const layer = layerRef.current
      const cap = capRef.current
      if (!box || !layer || !cap) return
      const { spans: sp, scenesById: byId, tl: doc, playing: isPlaying } = live.current
      const t = timeRef.current
      const at = sceneAt(sp, Math.min(t, Math.max(0, live.current.totalMs - 1)))
      const scene = at ? byId.get(at.span.id) : undefined

      // Canvas size = the box's, in device pixels, never above the export's.
      const rect = box.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const cw = Math.max(16, Math.min(ew, Math.round(rect.width * dpr)))
      const ch = Math.max(16, Math.round((cw * eh) / ew))
      for (const c of [layer, cap]) {
        if (c.width !== cw || c.height !== ch) {
          c.width = cw
          c.height = ch
          capKey = ''
        }
      }

      // Keep every clip in step: the active one plays (or holds its frame), the rest wait.
      for (const [id, el] of videoEls.current) {
        const isActive = scene?.id === id && at !== null
        el.style.opacity = isActive ? '1' : '0'
        el.volume = Math.min(1, Math.max(0, doc.clip_audio_volume))
        el.muted = doc.clip_audio_volume <= 0
        if (!isActive) {
          if (!el.paused) el.pause()
          continue
        }
        const want = at.clipMs / 1000
        if (isPlaying) {
          if (el.paused) {
            el.currentTime = want
            void el.play().catch(() => undefined)
          } else if (Math.abs(el.currentTime - want) > 0.3) {
            el.currentTime = want
          }
        } else {
          if (!el.paused) el.pause()
          if (Math.abs(el.currentTime - want) > 0.04) el.currentTime = want
        }
      }

      // The drawn layer: template cards always, clips only when the Pixel look is on.
      const ctx = layer.getContext('2d') as Ctx2D | null
      if (ctx) {
        ctx.clearRect(0, 0, cw, ch)
        const lookOn = doc.look.pixel_size > 0 || doc.look.scanlines
        if (scene?.kind === 'template' && scene.template && at) {
          drawTemplate(ctx, scene.template, cw, ch, (t - at.span.start_ms) / 1000)
          if (doc.look.scanlines) drawScanlines(ctx, cw, ch)
        } else if (scene?.kind === 'clip' && lookOn) {
          const el = videoEls.current.get(scene.id)
          if (el && el.readyState >= 2 && el.videoWidth > 0) {
            drawCover(ctx, el, el.videoWidth, el.videoHeight, cw, ch)
            const block = blockPx(doc.look, cw, ch)
            if (block > 1) look.pixelate(ctx, cw, ch, block)
            if (doc.look.scanlines) drawScanlines(ctx, cw, ch)
          }
        }
      }

      // Captions: redrawn only when what is on screen changes.
      const shown = captionsAt(doc.captions, t)
      const key = `${cw}x${ch}|${doc.caption_style}|${fontReady.current}|${shown.map((c) => `${c.id}:${c.text}:${c.style}:${c.position}`).join('|')}`
      if (key !== capKey) {
        capKey = key
        const cctx = cap.getContext('2d') as Ctx2D | null
        if (cctx) {
          cctx.clearRect(0, 0, cw, ch)
          drawCaptions(cctx, shown, doc.caption_style, cw, ch)
        }
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [ew, eh, look, timeRef])

  const at = sceneAt(spans, Math.min(timeMs, Math.max(0, totalMs - 1)))
  const activeScene = at ? scenesById.get(at.span.id) : undefined
  const holder = activeScene ? placeholderFor(activeScene, now) : null
  const ratio = ew / eh
  const clips = video.scenes.filter((s) => clipUrl(s, now))

  return (
    <div className="flex min-w-0 flex-col items-center gap-3">
      <div
        ref={boxRef}
        className="relative overflow-hidden rounded-[14px] border border-border bg-black shadow-[0_18px_44px_rgba(0,0,0,0.25)]"
        style={{ aspectRatio: `${ew} / ${eh}`, width: `min(100%, calc(min(58dvh, 600px) * ${ratio}))` }}
      >
        {clips.map((s) => (
          <video
            key={`${s.id}-${s.generation?.id}`}
            ref={(el) => {
              if (el) videoEls.current.set(s.id, el)
              else videoEls.current.delete(s.id)
            }}
            src={clipUrl(s, now) ?? undefined}
            className="absolute inset-0 h-full w-full object-cover opacity-0"
            playsInline
            preload="auto"
            muted
          />
        ))}
        <canvas ref={layerRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
        <canvas ref={capRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />

        {video.scenes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-[13px] leading-[1.55] text-[#c9cdd6]">
            <Clapperboard size={26} aria-hidden="true" className="text-accent" />
            Add a scene to start — with AI, from the Gallery, or a free title card.
          </div>
        )}
        {holder && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[rgba(10,12,17,0.82)] p-6 text-center text-[13px] font-semibold leading-[1.55] text-[#e7e9ee]">
            {holder.icon === 'wait' ? (
              <LoaderCircle size={24} aria-hidden="true" className="animate-spin text-accent" />
            ) : holder.icon === 'gone' ? (
              <ImageOff size={24} aria-hidden="true" className="text-[#ff7a7a]" />
            ) : (
              <TriangleAlert size={24} aria-hidden="true" className="text-[#ff7a7a]" />
            )}
            <span className="max-w-[260px] break-words">{holder.text}</span>
          </div>
        )}
      </div>

      <div className="flex w-full max-w-[640px] items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          disabled={totalMs <= 0}
          aria-label={playing ? 'Pause' : 'Play'}
          className="inline-flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-full border border-transparent bg-accent text-on-accent shadow-[0_8px_20px_var(--glow)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" className="ml-0.5 fill-current" />}
        </button>
        <input
          type="range"
          className={RANGE}
          min={0}
          max={Math.max(1, totalMs)}
          step={10}
          value={Math.min(timeMs, totalMs)}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Playhead"
          disabled={totalMs <= 0}
        />
        <span className="flex-none font-mono text-[12px] tabular-nums text-muted">
          {fmtClock(timeMs)} / {fmtClock(totalMs)}
        </span>
      </div>
    </div>
  )
}
