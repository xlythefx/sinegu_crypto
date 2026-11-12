import { useEffect, useRef } from 'react'
import { Plus, ShieldCheck, Trash2, Type } from 'lucide-react'
import { Segmented } from '../../../ui/filters'
import { SELECT } from '../../../settings/formClasses'
import { CAPTION_ROLES, CAPTION_STYLES, DISCLAIMER_TEXT, localId } from '../../../../lib/creativeVideos'
import { clampCaption } from '../../../../lib/videoEditor/timeline'
import type { CaptionPosition, CaptionRole, TimelineCaption, TimelineDoc } from '../../../../types/creativeVideos'
import { BTN_SOFT } from '../creativeClasses'
import { ICON_SQ, PANE_TITLE, ROW } from './editorClasses'
import SecondsInput from './SecondsInput'

interface CaptionsEditorProps {
  timeline: TimelineDoc
  totalMs: number
  timeMs: number
  selectedId: string | null
  onSelect: (id: string) => void
  onTimeline: (fn: (tl: TimelineDoc) => TimelineDoc) => void
}

const POSITIONS: Array<{ value: CaptionPosition; label: string }> = [
  { value: 'top', label: 'Top' },
  { value: 'middle', label: 'Middle' },
  { value: 'bottom', label: 'Bottom' },
]

/**
 * The on-screen captions: one row each (words, when it shows, hook / body /
 * disclaimer, top / middle / bottom) and the video's caption style. "Add the
 * disclaimer" puts the exact sentence over the last 3 seconds — any video
 * that cites a percentage needs it.
 */
export default function CaptionsEditor({ timeline, totalMs, timeMs, selectedId, onSelect, onTimeline }: CaptionsEditorProps) {
  const listRef = useRef<HTMLOListElement>(null)
  const captions = [...timeline.captions].sort((a, b) => a.start_ms - b.start_ms)
  const hasDisclaimer = captions.some((c) => c.style === 'disclaimer') || false

  useEffect(() => {
    if (!selectedId) return
    listRef.current?.querySelector(`[data-caption="${selectedId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedId])

  const patch = (id: string, p: Partial<TimelineCaption>) =>
    onTimeline((tl) => ({
      ...tl,
      captions: tl.captions.map((c) => (c.id === id ? clampCaption({ ...c, ...p }, Math.max(totalMs, 300)) : c)),
    }))

  const add = (c: Omit<TimelineCaption, 'id'>) => {
    const id = localId('cap')
    onTimeline((tl) => ({ ...tl, captions: [...tl.captions, clampCaption({ ...c, id }, Math.max(totalMs, 300))] }))
    onSelect(id)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h3 className={PANE_TITLE}>Caption style</h3>
        <Segmented
          value={timeline.caption_style}
          onChange={(v) => onTimeline((tl) => ({ ...tl, caption_style: v }))}
          ariaLabel="Caption style"
          size="sm"
          options={CAPTION_STYLES.map((c) => ({ value: c.key, label: c.label }))}
        />
        <span className="text-[11.5px] text-faint">{CAPTION_STYLES.find((c) => c.key === timeline.caption_style)?.hint}. Keep each caption to about six words.</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={BTN_SOFT}
          disabled={totalMs <= 0}
          onClick={() =>
            add({ text: '', start_ms: timeMs, end_ms: Math.min(totalMs, timeMs + 2500), style: captions.length === 0 ? 'hook' : 'body', position: captions.length === 0 ? 'top' : 'bottom' })
          }
        >
          <Plus size={14} aria-hidden="true" />
          Caption at the playhead
        </button>
        <button
          type="button"
          className={BTN_SOFT}
          disabled={totalMs <= 0 || hasDisclaimer}
          title={hasDisclaimer ? 'The video already has a disclaimer' : undefined}
          onClick={() => add({ text: DISCLAIMER_TEXT, start_ms: Math.max(0, totalMs - 3000), end_ms: totalMs, style: 'disclaimer', position: 'bottom' })}
        >
          <ShieldCheck size={14} aria-hidden="true" />
          Add the disclaimer
        </button>
      </div>

      {captions.length === 0 ? (
        <p className="flex items-center gap-2 rounded-row border border-dashed border-border px-4 py-6 text-[12.5px] text-muted">
          <Type size={15} aria-hidden="true" className="flex-none text-faint" />
          No captions yet. A hook in the first two seconds keeps people watching.
        </p>
      ) : (
        <ol ref={listRef} className="flex flex-col gap-2.5">
          {captions.map((c) => (
            <li
              key={c.id}
              data-caption={c.id}
              className={`${ROW} ${selectedId === c.id ? 'border-accent-line shadow-[0_0_0_1px_var(--accent)]' : ''}`}
              onFocusCapture={() => onSelect(c.id)}
            >
              <div className="flex items-start gap-2">
                <input
                  className="h-9 min-w-0 flex-1 rounded-field border border-border bg-surface px-2.5 text-[13px] text-text outline-none focus:border-accent-line"
                  value={c.text}
                  maxLength={160}
                  onChange={(e) => patch(c.id, { text: e.target.value })}
                  placeholder="What it says"
                  aria-label="Caption text"
                />
                <button
                  type="button"
                  className={ICON_SQ}
                  aria-label="Remove this caption"
                  onClick={() => onTimeline((tl) => ({ ...tl, captions: tl.captions.filter((x) => x.id !== c.id) }))}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <label className="flex flex-col gap-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-faint">
                  From (s)
                  <SecondsInput valueMs={c.start_ms} max={totalMs / 1000} onCommit={(ms) => patch(c.id, { start_ms: ms })} />
                </label>
                <label className="flex flex-col gap-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-faint">
                  To (s)
                  <SecondsInput valueMs={c.end_ms} max={totalMs / 1000} onCommit={(ms) => patch(c.id, { end_ms: ms })} />
                </label>
                <label className="flex flex-col gap-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-faint">
                  Kind
                  <select className={`${SELECT} h-9`} value={c.style} onChange={(e) => patch(c.id, { style: e.target.value as CaptionRole })}>
                    {CAPTION_ROLES.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-faint">
                  Where
                  <select className={`${SELECT} h-9`} value={c.position} onChange={(e) => patch(c.id, { position: e.target.value as CaptionPosition })}>
                    {POSITIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
