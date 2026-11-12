import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { Clock, ImageOff, LoaderCircle, TriangleAlert } from 'lucide-react'
import { EXPIRY_WARN_MS, fmtTimeLeft, msUntilExpiry } from '../../../../lib/creatives'
import { clipUrl, fmtSeconds, isSceneExpired } from '../../../../lib/creativeVideos'
import type { ClickModifiers } from '../../../../lib/videoEditor/selection'
import type { SceneSpan } from '../../../../lib/videoEditor/timeline'
import type { CreativeVideoScene, VideoAspect } from '../../../../types/creativeVideos'
import TemplateCanvas from './TemplateCanvas'

interface TimelineSceneProps {
  scene: CreativeVideoScene
  span: SceneSpan
  /** Pixels per millisecond. */
  scale: number
  aspect: VideoAspect
  now: number
  /** Picked for the chat: a gold ring. */
  selected: boolean
  /** A click, with Ctrl/Cmd (toggle) and Shift (range). */
  onSelect: (mods: ClickModifiers) => void
  /** A trim handle dragged to `ms` (inside the clip). Absent = the block cannot be trimmed. */
  onTrim?: (edge: 'in' | 'out', ms: number) => void
}

const HANDLE =
  'absolute inset-y-0 z-10 w-3 cursor-ew-resize touch-none bg-transparent after:absolute after:inset-y-2 after:left-1/2 after:w-[3px] after:-translate-x-1/2 after:rounded-full after:bg-accent after:opacity-0 after:transition-opacity group-hover:after:opacity-100'

/**
 * One scene on the timeline: a thumbnail (the clip's first used frame, or
 * the card drawn small), its label and length, its state, and — once it has
 * something to show — trim handles on both edges (drag). A slot still being
 * made is a dashed ghost with a spinner; a clip Higgsfield has deleted is red.
 */
export default function TimelineScene({ scene, span, scale, aspect, now, selected, onSelect, onTrim }: TimelineSceneProps) {
  const drag = useRef<{ edge: 'in' | 'out'; x: number; base: number } | null>(null)
  const width = Math.max(18, (span.end_ms - span.start_ms) * scale)
  const url = clipUrl(scene, now)
  const expired = isSceneExpired(scene, now)
  const waiting = scene.status === 'planned' || scene.status === 'generating'
  const failed = scene.status === 'failed'
  const left = scene.generation ? msUntilExpiry(scene.generation, now) : null

  const down = (edge: 'in' | 'out') => (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (!onTrim) return
    e.stopPropagation()
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { edge, x: e.clientX, base: edge === 'in' ? span.in_ms : span.out_ms }
  }
  const move = (e: ReactPointerEvent<HTMLSpanElement>) => {
    const d = drag.current
    if (!d || !onTrim) return
    onTrim(d.edge, d.base + (e.clientX - d.x) / scale)
  }
  const up = (e: ReactPointerEvent<HTMLSpanElement>) => {
    drag.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const tone = expired || failed
    ? 'border-[color-mix(in_srgb,var(--red)_55%,transparent)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)]'
    : waiting
      ? 'border-dashed border-accent-line bg-accent-soft/50'
      : 'border-border bg-surface2'

  return (
    <div
      className={`group absolute inset-y-[3px] overflow-hidden rounded-[8px] border transition-[box-shadow,border-color] duration-150 animate-[fadeup_0.3s_ease-out] ${tone} ${
        selected ? 'z-[2] border-accent shadow-[0_0_0_2px_var(--accent),0_0_14px_var(--glow)]' : 'hover:border-accent-line'
      }`}
      style={{ left: span.start_ms * scale, width }}
    >
      <button
        type="button"
        onClick={(e) => onSelect({ toggle: e.ctrlKey || e.metaKey, range: e.shiftKey })}
        aria-pressed={selected}
        aria-label={`Scene ${span.index + 1}: ${scene.label}`}
        className="absolute inset-0 flex cursor-pointer flex-col justify-end overflow-hidden bg-transparent p-0 text-left"
      >
        {scene.kind === 'template' && scene.template ? (
          <span className="absolute inset-0 opacity-90">
            <TemplateCanvas fields={scene.template} aspect={aspect} className="object-cover" />
          </span>
        ) : url ? (
          <video
            src={`${url}#t=${(span.in_ms / 1000).toFixed(2)}`}
            className="absolute inset-0 h-full w-full object-cover opacity-80"
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
          />
        ) : null}
        <span className="relative z-[1] flex min-w-0 items-center gap-1 bg-[linear-gradient(transparent,rgba(0,0,0,0.8)_55%)] px-1.5 pb-[3px] pt-2.5 text-[10.5px] font-bold leading-[1.2] text-white">
          {waiting && <LoaderCircle size={10} aria-hidden="true" className="flex-none animate-spin text-accent" />}
          {(failed || expired) &&
            (expired ? (
              <ImageOff size={10} aria-hidden="true" className="flex-none text-[#ff8a8a]" />
            ) : (
              <TriangleAlert size={10} aria-hidden="true" className="flex-none text-[#ff8a8a]" />
            ))}
          <span className="min-w-0 flex-1 truncate">
            {span.index + 1}. {scene.label}
          </span>
          {width > 92 && (
            <span className="flex-none font-mono text-[9.5px] font-medium text-[#d6d9e0]">
              {expired
                ? 'Deleted'
                : waiting
                  ? scene.status === 'planned'
                    ? 'Needs Go'
                    : 'Making…'
                  : failed
                    ? 'Failed'
                    : fmtSeconds(span.end_ms - span.start_ms)}
            </span>
          )}
        </span>
        {!expired && left !== null && left < EXPIRY_WARN_MS && width > 50 && (
          <span className="absolute right-1 top-0.5 z-[1] inline-flex items-center gap-0.5 rounded-pill bg-[rgba(0,0,0,0.65)] px-1 py-[1px] font-mono text-[9px] font-semibold leading-none text-[#ff8a8a]">
            <Clock size={8} aria-hidden="true" />
            {fmtTimeLeft(left)}
          </span>
        )}
      </button>
      {onTrim && (
        <>
          <span
            className={`${HANDLE} left-0`}
            onPointerDown={down('in')}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            role="slider"
            aria-label={`Trim the start of scene ${span.index + 1}`}
            aria-valuenow={Math.round(span.in_ms)}
          />
          <span
            className={`${HANDLE} right-0`}
            onPointerDown={down('out')}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            role="slider"
            aria-label={`Trim the end of scene ${span.index + 1}`}
            aria-valuenow={Math.round(span.out_ms)}
          />
        </>
      )}
    </div>
  )
}
