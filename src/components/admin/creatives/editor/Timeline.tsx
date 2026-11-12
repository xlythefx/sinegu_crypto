import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { SFX_SOUNDS, fmtSeconds } from '../../../../lib/creativeVideos'
import { sfxDurationMs } from '../../../../lib/videoEditor/sfx'
import { clampTrim, type SceneSpan } from '../../../../lib/videoEditor/timeline'
import type { CreativeAudioAsset, CreativeVideo, TimelineDoc } from '../../../../types/creativeVideos'
import { LANE_LABEL } from './editorClasses'
import TimelineScene from './TimelineScene'

export type EditorSelection =
  | { kind: 'scene'; id: number }
  | { kind: 'caption'; id: string }
  | { kind: 'sfx'; id: string }
  | null

interface TimelineProps {
  video: CreativeVideo
  spans: SceneSpan[]
  totalMs: number
  timeMs: number
  now: number
  selection: EditorSelection
  onSelect: (s: EditorSelection) => void
  onSeek: (ms: number) => void
  onTrim: (sceneId: number, patch: { trim_in_ms: number | null; trim_out_ms: number | null }) => void
  onTimeline: (fn: (tl: TimelineDoc) => TimelineDoc) => void
  audio: CreativeAudioAsset[]
  /** Open the Audio tab (a click on the music or voice lane). */
  onOpenAudio: () => void
}

/** The narrowest a second may be drawn; a phone scrolls sideways instead. */
const MIN_PX_PER_S = 22

const LANE = 'relative h-full min-w-0 flex-1'
const ROW_H: Record<string, string> = { scenes: 'h-[76px]', captions: 'h-9', sfx: 'h-9', music: 'h-7', voice: 'h-7' }

/**
 * The timeline: a ruler over the video's 30 seconds (click to move the
 * playhead), the scene track (blocks end to end, trim handles), the
 * captions, the sound effects (drag to move), and the music and voiceover
 * spans. Laid out in milliseconds × one scale, so it is the same arithmetic
 * as the preview and the export. On a phone it scrolls sideways.
 */
export default function Timeline({
  video,
  spans,
  totalMs,
  timeMs,
  now,
  selection,
  onSelect,
  onSeek,
  onTrim,
  onTimeline,
  audio,
  onOpenAudio,
}: TimelineProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [laneWidth, setLaneWidth] = useState(600)
  const sfxDrag = useRef<{ id: string; x: number; base: number } | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setLaneWidth(Math.max(200, el.clientWidth - 84 - 12)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const capMs = video.max_seconds * 1000
  const spanMs = Math.max(capMs, totalMs)
  const pxPerS = Math.max(MIN_PX_PER_S, laneWidth / (spanMs / 1000))
  const scale = pxPerS / 1000
  const width = spanMs * scale
  const tl = video.timeline
  const byId = new Map(video.scenes.map((s) => [s.id, s]))

  const ticks: number[] = []
  for (let s = 0; s <= spanMs / 1000; s++) ticks.push(s)

  const seekFrom = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    onSeek(Math.max(0, Math.min(totalMs, (e.clientX - rect.left) / scale)))
  }

  const assetMs = (id: number | undefined) => audio.find((a) => a.id === id)?.duration_ms ?? null
  const music = tl.music
  const musicSpan = music
    ? music.source === 'chiptune'
      ? { start: 0, end: totalMs, label: 'Chiptune' }
      : {
          start: music.start_ms,
          end: Math.min(totalMs, music.start_ms + (assetMs(music.asset_id) ?? totalMs)),
          label: audio.find((a) => a.id === music.asset_id)?.label ?? 'Music',
        }
    : null
  const voice = tl.voiceover
  const voiceSpan = voice
    ? {
        start: voice.start_ms,
        end: Math.min(spanMs, voice.start_ms + (assetMs(voice.asset_id) ?? 3000)),
        label: audio.find((a) => a.id === voice.asset_id)?.label ?? 'Voiceover',
      }
    : null

  return (
    <div ref={wrapRef} className="min-w-0 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:thin]">
      <div className="relative flex flex-col gap-1.5" style={{ width: width + 84 + 4 }}>
        {/* Ruler */}
        <div className="flex h-7">
          <span className={LANE_LABEL} aria-hidden="true" />
          <div className={`${LANE} cursor-pointer select-none touch-none`} onPointerDown={seekFrom} role="presentation">
            {/* Past the 30-second cap */}
            {totalMs > capMs && (
              <span
                className="absolute inset-y-0 bg-[color-mix(in_srgb,var(--red)_14%,transparent)]"
                style={{ left: capMs * scale, width: (totalMs - capMs) * scale }}
                title="Over the 30-second limit"
              />
            )}
            {ticks.map((s) => (
              <span key={s} className="absolute bottom-0 flex flex-col items-start" style={{ left: s * pxPerS }}>
                {s % 5 === 0 && (
                  <span className={`${s === 0 ? '' : '-translate-x-1/2'} pb-0.5 font-mono text-[9.5px] text-faint`}>{s}s</span>
                )}
                <span className={`w-px ${s % 5 === 0 ? 'h-2.5 bg-muted' : 'h-1.5 bg-hair'}`} />
              </span>
            ))}
          </div>
        </div>

        {/* Scenes */}
        <div className={`flex ${ROW_H.scenes}`}>
          <span className={LANE_LABEL}>Scenes</span>
          <div className={`${LANE} rounded-[10px] bg-surface2/50`}>
            {spans.length === 0 && (
              <span className="absolute inset-0 flex items-center px-3 text-[12px] text-faint">No scenes yet</span>
            )}
            {spans.map((sp) => {
              const scene = byId.get(sp.id)
              if (!scene) return null
              const canTrim = scene.kind === 'template' || scene.status === 'ready'
              const others = totalMs - (sp.end_ms - sp.start_ms)
              return (
                <TimelineScene
                  key={sp.id}
                  scene={scene}
                  span={sp}
                  scale={scale}
                  aspect={video.aspect}
                  now={now}
                  selected={selection?.kind === 'scene' && selection.id === sp.id}
                  onSelect={() => onSelect({ kind: 'scene', id: sp.id })}
                  onTrim={canTrim ? (edge, ms) => onTrim(sp.id, clampTrim(scene, edge, ms, Math.max(0, capMs - others))) : undefined}
                />
              )
            })}
          </div>
        </div>

        {/* Captions */}
        <div className={`flex ${ROW_H.captions}`}>
          <span className={LANE_LABEL}>Captions</span>
          <div className={`${LANE} rounded-[8px] bg-surface2/40`}>
            {tl.captions.map((c) => {
              const on = selection?.kind === 'caption' && selection.id === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect({ kind: 'caption', id: c.id })}
                  className={`absolute inset-y-1 cursor-pointer truncate rounded-[6px] border px-1.5 text-left text-[10.5px] font-semibold ${
                    on ? 'border-accent bg-accent text-on-accent' : 'border-accent-line bg-accent-soft text-accent hover:bg-surface'
                  }`}
                  style={{ left: c.start_ms * scale, width: Math.max(12, (c.end_ms - c.start_ms) * scale) }}
                  title={c.text}
                >
                  {c.text}
                </button>
              )
            })}
          </div>
        </div>

        {/* Sound effects */}
        <div className={`flex ${ROW_H.sfx}`}>
          <span className={LANE_LABEL}>Effects</span>
          <div className={`${LANE} rounded-[8px] bg-surface2/40`}>
            {tl.sfx.map((s) => {
              const on = selection?.kind === 'sfx' && selection.id === s.id
              const label = SFX_SOUNDS.find((x) => x.key === s.sound)?.label ?? s.sound
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelect({ kind: 'sfx', id: s.id })}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId)
                    sfxDrag.current = { id: s.id, x: e.clientX, base: s.at_ms }
                  }}
                  onPointerMove={(e) => {
                    const d = sfxDrag.current
                    if (!d || d.id !== s.id) return
                    const at = Math.round(Math.max(0, Math.min(totalMs, d.base + (e.clientX - d.x) / scale)) / 10) * 10
                    if (Math.abs(e.clientX - d.x) < 3) return
                    onTimeline((doc) => ({ ...doc, sfx: doc.sfx.map((x) => (x.id === s.id ? { ...x, at_ms: at } : x)) }))
                  }}
                  onPointerUp={() => {
                    sfxDrag.current = null
                  }}
                  className={`absolute inset-y-1 cursor-grab touch-none truncate rounded-[6px] border px-1.5 text-left text-[10.5px] font-semibold active:cursor-grabbing ${
                    on
                      ? 'border-teal bg-teal text-on-accent'
                      : 'border-[color-mix(in_srgb,var(--teal)_45%,transparent)] bg-[color-mix(in_srgb,var(--teal)_12%,transparent)] text-teal'
                  }`}
                  style={{ left: s.at_ms * scale, width: Math.max(64, sfxDurationMs(s.sound) * scale) }}
                  title={`${label} at ${fmtSeconds(s.at_ms)} — drag to move`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Music + voice */}
        {(['music', 'voice'] as const).map((lane) => {
          const sp = lane === 'music' ? musicSpan : voiceSpan
          return (
            <div key={lane} className={`flex ${ROW_H[lane]}`}>
              <span className={LANE_LABEL}>{lane === 'music' ? 'Music' : 'Voice'}</span>
              <div className={`${LANE} rounded-[8px] bg-surface2/40`}>
                {sp && (
                  <button
                    type="button"
                    onClick={onOpenAudio}
                    className={`absolute inset-y-1 cursor-pointer truncate rounded-[6px] border px-1.5 text-left text-[10.5px] font-semibold ${
                      lane === 'music'
                        ? 'border-[color-mix(in_srgb,var(--silver)_45%,transparent)] bg-[color-mix(in_srgb,var(--silver)_14%,transparent)] text-silver'
                        : 'border-[color-mix(in_srgb,var(--green)_45%,transparent)] bg-[color-mix(in_srgb,var(--green)_12%,transparent)] text-green'
                    }`}
                    style={{ left: sp.start * scale, width: Math.max(16, (sp.end - sp.start) * scale) }}
                  >
                    {sp.label}
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {/* Playhead */}
        <span
          className="pointer-events-none absolute bottom-0 top-0 z-20 w-0.5 -translate-x-1/2 bg-accent shadow-[0_0_8px_var(--glow)]"
          style={{ left: 84 + Math.min(timeMs, spanMs) * scale }}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
