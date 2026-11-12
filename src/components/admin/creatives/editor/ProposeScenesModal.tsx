import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, CircleAlert, Clapperboard, LayoutTemplate, Plus, Sparkles, Trash2 } from 'lucide-react'
import { Segmented } from '../../../ui/filters'
import { BTN_GHOST, BTN_PRIMARY, FIELD, HINT, INPUT, LABEL, SELECT } from '../../../settings/formClasses'
import {
  clampSceneSeconds,
  ENGINES,
  engineMeta,
  fmtSeconds,
  newTemplateFields,
  TEMPLATE_SECONDS,
  TEMPLATES,
} from '../../../../lib/creativeVideos'
import type { SceneDraft, SceneEngine, TemplateFields, TemplateKey } from '../../../../types/creativeVideos'
import CreativeModal from '../CreativeModal'
import ToggleSwitch from '../ToggleSwitch'
import { BTN_SOFT, NOTICE, TEXTAREA } from '../creativeClasses'
import { ICON_SQ } from './editorClasses'
import { TemplateFieldsForm } from './TemplateEditor'

interface Row extends SceneDraft {
  key: string
}

interface ProposeScenesModalProps {
  open: boolean
  /** Regenerate: one row, prefilled; the scene is re-planned in its place. */
  replace: { sceneId: number; draft: SceneDraft; durationMs: number } | null
  /** The style's engine and card family, for new rows. */
  defaultEngine: SceneEngine
  templateFamily: 'pixel' | 'clean'
  /** Room left under the 30-s cap (before a replaced scene is taken out). */
  usedMs: number
  capMs: number
  busy: boolean
  error: string | null
  onClose: () => void
  onSubmit: (drafts: SceneDraft[], replaceSceneId?: number) => void
}

const MAX_SCENES = 6

let seq = 0
const rowKey = () => `r${++seq}`

function clipRow(engine: SceneEngine): Row {
  return { key: rowKey(), kind: 'clip', label: '', prompt: '', seconds: engine === 'kling' ? 5 : 5, engine, with_character: false, caption: null, template: null }
}

function templateRow(family: 'pixel' | 'clean'): Row {
  const key: TemplateKey = family === 'pixel' ? 'pixel-scoreboard' : 'clean-stat'
  return { key: rowKey(), kind: 'template', label: 'Card', prompt: '', seconds: 3, engine: null, with_character: false, caption: null, template: newTemplateFields(key) }
}

/** A rough guide only — the job card shows Higgsfield's real price before Go. */
function roughUsd(r: Row): number {
  if (r.kind === 'template') return 0
  if (r.engine === 'seedance') return 0.2647 * r.seconds
  return 0.0525 * r.seconds + (r.with_character ? 0.03 : 0.004)
}

/**
 * "Add scenes with AI": up to six scenes, each with its own engine — Kling
 * (silent, cheaper; the music carries it) or Seedance (with its own sound) —
 * Pixel OFF unless switched on for that scene, and an optional caption.
 * Free template cards can be mixed in. Submitting only PRICES them: the
 * scenes appear on the timeline as waiting slots, and the job card that
 * comes back is where Go spends the money.
 */
export default function ProposeScenesModal({
  open,
  replace,
  defaultEngine,
  templateFamily,
  usedMs,
  capMs,
  busy,
  error,
  onClose,
  onSubmit,
}: ProposeScenesModalProps) {
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    if (!open) return
    setRows(replace ? [{ ...replace.draft, key: rowKey() }] : [clipRow(defaultEngine)])
  }, [open, replace, defaultEngine])

  const set = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const move = (i: number, d: number) =>
    setRows((rs) => {
      const j = i + d
      if (j < 0 || j >= rs.length) return rs
      const next = [...rs]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const room = capMs - usedMs + (replace?.durationMs ?? 0)
  const asked = rows.reduce((s, r) => s + r.seconds * 1000, 0)
  const problem =
    rows.length === 0
      ? 'Add at least one scene.'
      : rows.some((r) => !r.label.trim())
        ? 'Give every scene a short name.'
        : rows.some((r) => r.kind === 'clip' && r.prompt.trim().length < 8)
          ? 'Describe each clip in a sentence — what we see, what moves, the camera.'
          : asked > room
            ? `That is ${fmtSeconds(asked)} of scenes, but only ${fmtSeconds(Math.max(0, room))} is left under the ${capMs / 1000}-second limit.`
            : null
  const clipsCount = rows.filter((r) => r.kind === 'clip').length
  const rough = rows.reduce((s, r) => s + roughUsd(r), 0)

  const submit = () => {
    if (problem || busy) return
    const drafts: SceneDraft[] = rows.map(({ key: _k, ...r }) => ({
      ...r,
      label: r.label.trim(),
      prompt: r.kind === 'clip' ? r.prompt.trim() : '',
      caption: r.caption?.trim() ? r.caption.trim() : null,
      engine: r.kind === 'clip' ? r.engine : null,
      with_character: r.kind === 'clip' ? r.with_character : false,
      template: r.kind === 'template' ? r.template : null,
    }))
    onSubmit(drafts, replace?.sceneId)
  }

  return (
    <CreativeModal
      open={open}
      title={replace ? 'Regenerate this scene' : 'Add scenes with AI'}
      subtitle={
        replace
          ? 'It is made again in the same place on the timeline. You can change the words, the engine or the length.'
          : 'Describe each scene. Nothing is spent here — you get a priced job, and the clips are made together when you press Go.'
      }
      onClose={onClose}
      maxWidth={780}
    >
      <div className="flex flex-col gap-4">
        <ol className="flex flex-col gap-3.5">
          {rows.map((r, i) => (
            <li key={r.key} className="flex flex-col gap-3.5 rounded-row border border-hair bg-surface2/60 p-3.5 sm:p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-7 w-7 flex-none place-items-center rounded-full border border-border bg-surface font-mono text-[11.5px] font-semibold text-muted">
                  {i + 1}
                </span>
                {!replace && (
                  <Segmented
                    value={r.kind}
                    onChange={(kind) =>
                      setRows((rs) =>
                        rs.map((x) => (x.key === r.key ? (kind === 'clip' ? { ...clipRow(defaultEngine), key: x.key, label: x.label } : { ...templateRow(templateFamily), key: x.key }) : x)),
                      )
                    }
                    size="sm"
                    ariaLabel={`Scene ${i + 1} kind`}
                    options={[
                      { value: 'clip', label: 'AI clip', icon: Clapperboard },
                      { value: 'template', label: 'Card · free', icon: LayoutTemplate },
                    ]}
                  />
                )}
                {!replace && rows.length > 1 && (
                  <div className="ml-auto flex gap-1.5">
                    <button type="button" className={ICON_SQ} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                      <ArrowUp size={15} aria-hidden="true" />
                    </button>
                    <button type="button" className={ICON_SQ} onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down">
                      <ArrowDown size={15} aria-hidden="true" />
                    </button>
                    <button type="button" className={ICON_SQ} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label="Remove this scene">
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>

              <label className={FIELD}>
                <span className={LABEL}>Name</span>
                <input className={INPUT} value={r.label} maxLength={80} onChange={(e) => set(r.key, { label: e.target.value })} placeholder="Hook — the city at night" />
              </label>

              {r.kind === 'clip' ? (
                <>
                  <label className={FIELD}>
                    <span className={LABEL}>What we see</span>
                    <textarea
                      className={`${TEXTAREA} min-h-[84px]`}
                      value={r.prompt}
                      maxLength={2000}
                      onChange={(e) => set(r.key, { prompt: e.target.value })}
                      placeholder="Slow push-in on a glowing trading screen in a dark room, neon reflections, cinematic"
                    />
                    <span className={HINT}>Subject, action, camera move, light. No figures inside a clip — put numbers on a card or a caption so they are exact.</span>
                  </label>
                  <div className="grid gap-3.5 sm:grid-cols-[minmax(0,1fr)_150px]">
                    <div className="flex flex-col gap-1.5">
                      <span className={LABEL}>Engine</span>
                      <Segmented
                        value={r.engine ?? 'kling'}
                        onChange={(engine) => set(r.key, { engine, seconds: clampSceneSeconds('clip', engine, r.seconds) })}
                        size="sm"
                        ariaLabel={`Scene ${i + 1} engine`}
                        options={ENGINES.map((e) => ({ value: e.key, label: `${e.label} · ${e.sound ? 'with sound' : 'silent'}` }))}
                      />
                      <span className={HINT}>{engineMeta(r.engine ?? 'kling').hint}</span>
                    </div>
                    <label className={FIELD}>
                      <span className={LABEL}>Length</span>
                      <select className={SELECT} value={r.seconds} onChange={(e) => set(r.key, { seconds: Number(e.target.value) })}>
                        {engineMeta(r.engine ?? 'kling').seconds.map((s) => (
                          <option key={s} value={s}>
                            {s} seconds
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <ToggleSwitch on={r.with_character} onChange={(v) => set(r.key, { with_character: v })} label="Pixel in this scene" showState={false} />
                    <span className="text-[13px] font-semibold text-text">Pixel in this scene</span>
                    <span className="text-[12px] text-muted">Off by default — the mascot is a guest, not the host.</span>
                  </div>
                </>
              ) : (
                <div className="grid gap-3.5 sm:grid-cols-[minmax(0,1fr)_150px]">
                  <div className="flex flex-col gap-3.5">
                    <label className={FIELD}>
                      <span className={LABEL}>Card</span>
                      <select
                        className={SELECT}
                        value={r.template?.key ?? 'clean-stat'}
                        onChange={(e) => set(r.key, { template: newTemplateFields(e.target.value as TemplateKey) })}
                      >
                        {TEMPLATES.map((t) => (
                          <option key={t.key} value={t.key}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {r.template && <TemplateFieldsForm fields={r.template} onChange={(t: TemplateFields) => set(r.key, { template: t })} />}
                  </div>
                  <label className={FIELD}>
                    <span className={LABEL}>Length</span>
                    <select className={SELECT} value={r.seconds} onChange={(e) => set(r.key, { seconds: Number(e.target.value) })}>
                      {TEMPLATE_SECONDS.map((s) => (
                        <option key={s} value={s}>
                          {s} seconds
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              <label className={FIELD}>
                <span className={LABEL}>Caption (optional)</span>
                <input
                  className={INPUT}
                  value={r.caption ?? ''}
                  maxLength={120}
                  onChange={(e) => set(r.key, { caption: e.target.value })}
                  placeholder="Six words or fewer"
                />
              </label>
            </li>
          ))}
        </ol>

        {!replace && rows.length < MAX_SCENES && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BTN_SOFT} onClick={() => setRows((rs) => [...rs, clipRow(defaultEngine)])}>
              <Plus size={14} aria-hidden="true" />
              Add an AI clip
            </button>
            <button type="button" className={BTN_SOFT} onClick={() => setRows((rs) => [...rs, templateRow(templateFamily)])}>
              <LayoutTemplate size={14} aria-hidden="true" />
              Add a template card
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-row border border-hair px-3.5 py-2.5 text-[12.5px] text-muted">
          <span>
            {rows.length} scene{rows.length === 1 ? '' : 's'} · {fmtSeconds(asked)} · {fmtSeconds(Math.max(0, room))} left under the limit
          </span>
          {clipsCount > 0 && <span>Roughly ${rough.toFixed(2)} — the exact price comes before Go</span>}
        </div>

        {(error || (problem && rows.some((r) => r.label || r.prompt))) && (
          <p className={NOTICE.error} role="alert">
            <CircleAlert size={15} aria-hidden="true" />
            {error ?? problem}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2.5 border-t border-hair pt-4 sm:flex-row sm:justify-end">
          <button type="button" className={BTN_GHOST} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={BTN_PRIMARY} onClick={submit} disabled={!!problem || busy}>
            <Sparkles size={14} aria-hidden="true" />
            {busy ? 'Pricing…' : clipsCount > 0 ? 'Price these scenes' : 'Add the cards'}
          </button>
        </div>
      </div>
    </CreativeModal>
  )
}
