import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { SFX_SOUNDS, fmtSeconds } from '../../../../lib/creativeVideos'
import { isSelected, scenesCrossed, type ClickModifiers, type SceneSelection } from '../../../../lib/videoEditor/selection'
import { sfxDurationMs } from '../../../../lib/videoEditor/sfx'
import { clampTrim, type SceneSpan } from '../../../../lib/videoEditor/timeline'
import type { CreativeAudioAsset, CreativeVideo, TimelineDoc } from '../../../../types/creativeVideos'
import { LANE_LABEL, TIMELINE_LABEL_W } from './editorClasses'
import TimelineScene from './TimelineScene'

/** A caption or a sound effect picked on the timeline (scenes have their own, multi-pick selection). */
export type EditorSelection = { kind: 'caption'; id: string } | { kind: 'sfx'; id: string } | null

interface TimelineProps {
  video: CreativeVideo
  spans: SceneSpan[]
  totalMs: number
  timeMs: number
  now: number
  selection: EditorSelection
  onSelect: (s: EditorSelection) => void
  /** The picked scenes (what the chat talks about). */
  picked: SceneSelection
  /** A click on a scene block, with its modifiers (Ctrl/Cmd toggles, Shift picks a run). */
  onPickScene: (id: number, mods: ClickModifiers) => void
  /** A drag across the scene track: the scenes it crossed (added with a modifier held). */
  onMarquee: (ids: number[], additive: boolean) => void
  /** A click on the scene track's empty space. */
  onClearPick: () => void
  onSeek: (ms: number) => void
  onTrim: (sceneId: number, patch: { trim_in_ms: number | null; trim_out_ms: number | null }) => void
  onTimeline: (fn: (tl: TimelineDoc) => TimelineDoc) => void
  audio: CreativeAudioAsset[]
  /** Open the Audio tab (a click on the music or voice lane). */
  onOpenAudio: () => void
}

/** The narrowest a second may be drawn; a phone scrolls sideways instead. */
const MIN_PX_PER_S = 22
/** A press on the scene track becomes a drag (marquee) past this many pixels. */
const DRAG_PX = 5

const LANE = 'relative h-full min-w-0 flex-1'
const ROW_H: Record<string, string> = {
  scenes: 'h-10',
  captions: 'h-[26px]',
  sfx: 'h-[26px]',
  music: 'h-[22px]',
  voice: 'h-[22px]',
}
const CHIP = 'absolute inset-y-[3px] truncate rounded-[5px] border px-1.5 text-left text-[10px] font-semibold leading-[18px]'

interface Marquee {
  pointerId: number
  /** Lane x where the press started. */
  x0: number
  additive: boolean
  /** Started on the track itself, not on a scene. */
  onEmpty: boolean
  active: boolean
}

/**
 * The timeline: a ruler over the video's 30 seconds (click to move the
 * playhead), the scene track (blocks end to end, trim handles), the
 * captions, the sound effects (drag to move), and the music and voiceover
 * spans. Laid out in milliseconds x one scale, so it is the same arithmetic
 * as the preview and the export. On a phone it scrolls sideways.
 *
 * Scenes are PICKED here for the chat: click one (Ctrl/Cmd adds, Shift picks
 * a run), or press and drag across the track (from empty space or over the
 * clips) to pick every scene the drag crosses; a click on empty track
 * clears it. A drag is mouse / pen only: on a touch screen a drag scrolls.
 */
export default function Timeline({
  video,
  spans,
  totalMs,
  timeMs,
  now,
  selection,
  onSelect,
  picked,
  onPickScene,
  onMarquee,
  onClearPick,
  onSeek,
  onTrim,
  onTimeline,
  audio,
  onOpenAudio,
}: TimelineProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [laneWidth, setLaneWidth] = useState(600)
  const sfxDrag = useRef<{ id: string; x: number; base: number } | null>(null)
  const marquee = useRef<Marquee | null>(null)
  const [box, setBox] = useState<{ x0: number; x1: number } | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setLaneWidth(Math.max(200, el.clientWidth - TIMELINE_LABEL_W - 12)))
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

  /* ---------- picking scenes by dragging across the track ---------- */

  const laneX = (e: ReactPointerEvent<HTMLDivElement>) =>
    Math.max(0, Math.min(width, e.clientX - e.currentTarget.getBoundingClientRect().left))

  const onTrackDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.pointerType === 'touch') return
    marquee.current = {
      pointerId: e.pointerId,
      x0: laneX(e),
      additive: e.ctrlKey || e.metaKey || e.shiftKey,
      onEmpty: e.target === e.currentTarget,
      active: false,
    }
  }
  const onTrackMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const m = marquee.current
    if (!m || m.pointerId !== e.pointerId) return
    const x = laneX(e)
    if (!m.active) {
      if (Math.abs(x - m.x0) < DRAG_PX) return
      m.active = true
      // Captured: the release lands on the track, so the scene under the press is not also clicked.
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    setBox({ x0: m.x0, x1: x })
  }
  const onTrackUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const m = marquee.current
    marquee.current = null
    if (!m || m.pointerId !== e.pointerId) return
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (m.active) {
      setBox(null)
      onMarquee(scenesCrossed(spans, m.x0 / scale, laneX(e) / scale), m.additive)
    } else if (m.onEmpty && e.target === e.currentTarget) {
      onClearPick()
    }
  }
  const onTrackCancel = () => {
    marquee.current = null
    setBox(null)
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
    <div ref={wrapRef} className="min-w-0 overflow-x-auto overscroll-x-contain pb-0.5 [scrollbar-width:thin]">
      <div className="relative flex flex-col gap-1" style={{ width: width + TIMELINE_LABEL_W + 4 }}>
        {/* Ruler */}
        <div className="flex h-5">
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
                  <span className={`${s === 0 ? '' : '-translate-x-1/2'} pb-px font-mono text-[9px] leading-none text-faint`}>{s}s</span>
                )}
                <span className={`w-px ${s % 5 === 0 ? 'h-2 bg-muted' : 'h-1 bg-hair'}`} />
              </span>
            ))}
          </div>
        </div>

        {/* Scenes */}
        <div className={`flex ${ROW_H.scenes}`}>
          <span className={LANE_LABEL}>Scenes</span>
          <div
            className={`${LANE} select-none rounded-[9px] bg-surface2/50`}
            onPointerDown={onTrackDown}
            onPointerMove={onTrackMove}
            onPointerUp={onTrackUp}
            onPointerCancel={onTrackCancel}
            role="group"
            aria-label="Scene track: click a scene to pick it for the chat, Ctrl or Shift to pick several, drag across to pick a run"
          >
            {spans.length === 0 && (
              <span className="pointer-events-none absolute inset-0 flex items-center px-3 text-[12px] text-faint">No scenes yet</span>
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
                  selected={isSelected(picked, sp.id)}
                  onSelect={(mods) => onPickScene(sp.id, mods)}
                  onTrim={canTrim ? (edge, ms) => onTrim(sp.id, clampTrim(scene, edge, ms, Math.max(0, capMs - others))) : undefined}
                />
              )
            })}
            {box && (
              <span
                className="pointer-events-none absolute inset-y-0 z-20 rounded-[6px] border border-accent bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]"
                style={{ left: Math.min(box.x0, box.x1), width: Math.abs(box.x1 - box.x0) }}
                aria-hidden="true"
              />
            )}
          </div>
        </div>

        {/* Captions */}
        <div className={`flex ${ROW_H.captions}`}>
          <span className={LANE_LABEL}>Captions</span>
          <div className={`${LANE} rounded-[7px] bg-surface2/40`}>
            {tl.captions.map((c) => {
              const on = selection?.kind === 'caption' && selection.id === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect({ kind: 'caption', id: c.id })}
                  className={`${CHIP} cursor-pointer ${
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
          <div className={`${LANE} rounded-[7px] bg-surface2/40`}>
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
                  className={`${CHIP} cursor-grab touch-none active:cursor-grabbing ${
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
        {(voiceSpan ? (['music', 'voice'] as const) : (['music'] as const)).map((lane) => {
          const sp = lane === 'music' ? musicSpan : voiceSpan
          return (
            <div key={lane} className={`flex ${ROW_H[lane]}`}>
              <span className={LANE_LABEL}>{lane === 'music' ? 'Music' : 'Voice'}</span>
              <div className={`${LANE} rounded-[7px] bg-surface2/40`}>
                {sp && (
                  <button
                    type="button"
                    onClick={onOpenAudio}
                    className={`absolute inset-y-[2px] cursor-pointer truncate rounded-[5px] border px-1.5 text-left text-[10px] font-semibold leading-[16px] ${
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
          style={{ left: TIMELINE_LABEL_W + Math.min(timeMs, spanMs) * scale }}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
