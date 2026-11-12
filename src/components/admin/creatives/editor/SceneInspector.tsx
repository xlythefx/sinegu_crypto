import { useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Clock, Film, LayoutTemplate, MessageSquare, PenLine, Replace, RotateCcw, Sparkles, Trash2, WandSparkles } from 'lucide-react'
import ConfirmModal from '../../../ui/ConfirmModal'
import { INPUT } from '../../../settings/formClasses'
import { EXPIRY_WARN_MS, fmtTimeLeft, msUntilExpiry } from '../../../../lib/creatives'
import { fmtSeconds, isSceneExpired, sceneStatusMeta, templateMeta } from '../../../../lib/creativeVideos'
import { isSelected, type ClickModifiers, type SceneSelection } from '../../../../lib/videoEditor/selection'
import { effectiveTrim, fullMs, type SceneSpan } from '../../../../lib/videoEditor/timeline'
import type { CreativeVideoScene, TemplateFields } from '../../../../types/creativeVideos'
import TonePill from '../TonePill'
import { BTN_SOFT, BTN_SOFT_DANGER, FACT_LABEL } from '../creativeClasses'
import { ICON_SQ_SM, PANE_TITLE, ROW } from './editorClasses'
import SecondsInput from './SecondsInput'

interface SceneInspectorProps {
  scenes: CreativeVideoScene[]
  spans: SceneSpan[]
  /** The scenes picked for the chat (gold ring). One picked = its details below the list. */
  picked: SceneSelection
  now: number
  busy: boolean
  /** A click on a row, with Ctrl/Cmd (toggle) and Shift (range). */
  onPick: (id: number, mods: ClickModifiers) => void
  /** "All scenes": nothing picked, the chat works on the whole video. */
  onClearPick: () => void
  /** "Improve with AI": pick this scene, open the chat, prefill the ask. */
  onImprove: (scene: CreativeVideoScene, n: number) => void
  /** Several picked: open the chat about them. */
  onAskAbout: () => void
  /** Buttons above the list (add scenes with AI, from the Gallery, a free card). */
  actions?: ReactNode
  onMove: (id: number, delta: number) => void
  onLabel: (id: number, label: string) => void
  onTrim: (id: number, patch: { trim_in_ms: number | null; trim_out_ms: number | null }) => void
  onReplaceClip: (scene: CreativeVideoScene) => void
  onRegenerate: (scene: CreativeVideoScene) => void
  onEditCard: (scene: CreativeVideoScene, fields: TemplateFields) => void
  onRemove: (scene: CreativeVideoScene) => void
  onSeek: (ms: number) => void
}

/**
 * The Scenes tab: every scene in order — the one place a phone reorders them
 * (left / right buttons) — and, for the picked one, its name, trims, how
 * long Higgsfield keeps it, and Improve with AI / Replace / Regenerate /
 * Edit the card / Remove (Remove asks first). A click picks a scene for the
 * chat (Ctrl/Cmd adds, Shift picks a run); "All scenes" clears the pick.
 */
export default function SceneInspector({
  scenes,
  spans,
  picked,
  now,
  busy,
  onPick,
  onClearPick,
  onImprove,
  onAskAbout,
  actions,
  onMove,
  onLabel,
  onTrim,
  onReplaceClip,
  onRegenerate,
  onEditCard,
  onRemove,
  onSeek,
}: SceneInspectorProps) {
  const [removing, setRemoving] = useState<CreativeVideoScene | null>(null)
  const ordered = spans.map((sp) => ({ sp, scene: scenes.find((s) => s.id === sp.id) })).filter((x): x is { sp: SceneSpan; scene: CreativeVideoScene } => !!x.scene)
  const selected = picked.ids.length === 1 ? (ordered.find((x) => x.scene.id === picked.ids[0]) ?? null) : null
  const many = picked.ids.length > 1

  return (
    <div className="flex flex-col gap-3">
      {actions}
      {ordered.length > 0 && (
        <div className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 flex-1 text-[11.5px] leading-[1.45] text-faint">
            {picked.ids.length === 0
              ? 'Click a scene to target it in the chat · Ctrl or Shift for several'
              : `${picked.ids.length} of ${ordered.length} picked — the chat works on ${picked.ids.length === 1 ? 'it' : 'these'}`}
          </p>
          {picked.ids.length > 0 && (
            <button
              type="button"
              onClick={onClearPick}
              className="inline-flex min-h-7 flex-none cursor-pointer items-center rounded-pill border border-border bg-surface px-2.5 text-[11.5px] font-bold text-text transition-colors duration-150 hover:border-accent-line hover:text-accent"
            >
              All scenes
            </button>
          )}
        </div>
      )}
      {ordered.length === 0 ? (
        <p className="rounded-row border border-dashed border-border px-4 py-8 text-center text-[13px] leading-[1.6] text-muted">
          No scenes yet. Add some with AI, pick finished clips from the Gallery, or add a free card.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {ordered.map(({ sp, scene }, i) => {
            const meta = sceneStatusMeta(isSceneExpired(scene, now) ? 'expired' : scene.status)
            const on = isSelected(picked, scene.id)
            return (
              <li
                key={scene.id}
                className={`flex items-center gap-1.5 rounded-row border px-2 py-1.5 transition-[border-color,background,box-shadow] duration-150 ${
                  on ? 'border-accent bg-accent-soft shadow-[0_0_0_1px_var(--accent)]' : 'border-hair bg-surface2/60'
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    const mods = { toggle: e.ctrlKey || e.metaKey, range: e.shiftKey }
                    onPick(scene.id, mods)
                    if (!mods.toggle && !mods.range) onSeek(sp.start_ms)
                  }}
                  aria-pressed={on}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 bg-transparent text-left"
                >
                  <span
                    className={`grid h-6 w-6 flex-none place-items-center rounded-full border font-mono text-[10.5px] font-semibold ${
                      on ? 'border-accent bg-accent text-on-accent' : 'border-border bg-surface text-muted'
                    }`}
                  >
                    {i + 1}
                  </span>
                  {scene.kind === 'template' ? (
                    <LayoutTemplate size={14} aria-hidden="true" className="flex-none text-accent" />
                  ) : (
                    <Film size={14} aria-hidden="true" className="flex-none text-accent" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold leading-[1.35] text-text">{scene.label}</span>
                    <span className="block font-mono text-[10px] leading-[1.3] text-faint">
                      {fmtSeconds(sp.end_ms - sp.start_ms)}
                      <span className="sm:hidden"> · {meta.label}</span>
                    </span>
                  </span>
                  <span className="max-sm:hidden">
                    <TonePill tone={meta.tone}>{meta.label}</TonePill>
                  </span>
                </button>
                <button type="button" className={ICON_SQ_SM} onClick={() => onMove(scene.id, -1)} disabled={i === 0 || busy} aria-label={`Move scene ${i + 1} earlier`}>
                  <ArrowLeft size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={ICON_SQ_SM}
                  onClick={() => onMove(scene.id, 1)}
                  disabled={i === ordered.length - 1 || busy}
                  aria-label={`Move scene ${i + 1} later`}
                >
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ol>
      )}

      {many && (
        <div className={`${ROW} flex-row flex-wrap items-center gap-2 p-3 animate-[fadeup_0.3s_ease-out]`}>
          <p className="min-w-[160px] flex-1 text-[12.5px] leading-[1.5] text-muted">
            <strong className="font-bold text-text">{picked.ids.length} scenes picked.</strong> Tell the chat what to do with them — for example “make these faster” or “improve the visuals”.
          </p>
          <button type="button" className={BTN_SOFT} onClick={onAskAbout}>
            <MessageSquare size={14} aria-hidden="true" />
            Ask the chat
          </button>
        </div>
      )}

      {selected && (
        <SceneDetails
          key={selected.scene.id}
          scene={selected.scene}
          span={selected.sp}
          now={now}
          busy={busy}
          onImprove={() => onImprove(selected.scene, selected.sp.index + 1)}
          onLabel={onLabel}
          onTrim={onTrim}
          onReplaceClip={onReplaceClip}
          onRegenerate={onRegenerate}
          onEditCard={onEditCard}
          onRemove={() => setRemoving(selected.scene)}
        />
      )}

      <ConfirmModal
        open={removing !== null}
        title={`Remove “${removing?.label ?? 'this scene'}”?`}
        message={
          removing?.kind === 'clip'
            ? 'It comes off this video. The clip itself stays in the Gallery until Higgsfield deletes it.'
            : 'The card comes off this video.'
        }
        confirmLabel="Remove"
        cancelLabel="Keep it"
        danger
        onConfirm={() => {
          const s = removing
          setRemoving(null)
          if (s) onRemove(s)
        }}
        onCancel={() => setRemoving(null)}
      />
    </div>
  )
}

function SceneDetails({
  scene,
  span,
  now,
  busy,
  onLabel,
  onTrim,
  onReplaceClip,
  onRegenerate,
  onEditCard,
  onRemove,
  onImprove,
}: {
  scene: CreativeVideoScene
  span: SceneSpan
  now: number
  busy: boolean
  onImprove: () => void
  onLabel: (id: number, label: string) => void
  onTrim: (id: number, patch: { trim_in_ms: number | null; trim_out_ms: number | null }) => void
  onReplaceClip: (scene: CreativeVideoScene) => void
  onRegenerate: (scene: CreativeVideoScene) => void
  onEditCard: (scene: CreativeVideoScene, fields: TemplateFields) => void
  onRemove: () => void
}) {
  const full = fullMs(scene)
  const trim = effectiveTrim(scene)
  const expired = isSceneExpired(scene, now)
  const left = scene.generation ? msUntilExpiry(scene.generation, now) : null
  const canTrim = scene.kind === 'template' || scene.status === 'ready'
  const toTrims = (in_ms: number, out_ms: number) => ({ trim_in_ms: in_ms <= 0 ? null : in_ms, trim_out_ms: out_ms >= full ? null : out_ms })

  return (
    <div className={`${ROW} gap-3 p-3 animate-[fadeup_0.3s_ease-out]`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className={`${PANE_TITLE} min-w-0 flex-1`}>Scene {span.index + 1}</h3>
        <button
          type="button"
          onClick={onImprove}
          title="Ask the chat to improve this scene — it proposes a new version, priced, before anything is made"
          className="inline-flex min-h-8 flex-none cursor-pointer items-center gap-1.5 rounded-field border border-accent-line bg-accent-soft px-3 text-[12px] font-bold text-accent transition-[background,border-color] duration-150 hover:border-accent hover:bg-surface"
        >
          <WandSparkles size={14} aria-hidden="true" />
          Improve with AI
        </button>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className={FACT_LABEL}>Name</span>
        <input className={INPUT} value={scene.label} maxLength={80} onChange={(e) => onLabel(scene.id, e.target.value)} />
      </label>

      {scene.kind === 'clip' ? (
        <div className="flex flex-col gap-1.5 text-[12.5px] leading-[1.55] text-muted">
          <span className={FACT_LABEL}>Made with</span>
          <span className="text-text">
            {scene.engine_label ?? scene.generation?.model_label ?? 'A Gallery clip'}
            {scene.with_character ? ' · with Pixel' : ''}
          </span>
          {scene.prompt && <span className="break-words">“{scene.prompt}”</span>}
          {scene.status === 'failed' && scene.error && <span className="font-semibold text-red">{scene.error}</span>}
          {expired ? (
            <span className="font-semibold text-red">Deleted by Higgsfield — replace or regenerate it before exporting.</span>
          ) : (
            left !== null && (
              <span className={`inline-flex items-center gap-1.5 ${left < EXPIRY_WARN_MS ? 'font-semibold text-red' : ''}`}>
                <Clock size={12} aria-hidden="true" />
                Higgsfield deletes it in {fmtTimeLeft(left)} — export before then.
              </span>
            )
          )}
        </div>
      ) : (
        scene.template && (
          <div className="flex flex-col gap-1 text-[12.5px] text-muted">
            <span className={FACT_LABEL}>Card</span>
            <span className="text-text">{templateMeta(scene.template.key).label} · free</span>
          </div>
        )
      )}

      {canTrim && (
        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1.5">
            <span className={FACT_LABEL}>Starts at (s in the clip)</span>
            <SecondsInput valueMs={trim.in_ms} max={full / 1000} onCommit={(ms) => onTrim(scene.id, toTrims(Math.min(ms, trim.out_ms - 500), trim.out_ms))} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={FACT_LABEL}>Ends at (of {fmtSeconds(full)})</span>
            <SecondsInput valueMs={trim.out_ms} max={full / 1000} onCommit={(ms) => onTrim(scene.id, toTrims(trim.in_ms, Math.max(ms, trim.in_ms + 500)))} />
          </label>
          {(trim.in_ms > 0 || trim.out_ms < full) && (
            <button type="button" className={`${BTN_SOFT} col-span-2 justify-self-start`} onClick={() => onTrim(scene.id, { trim_in_ms: null, trim_out_ms: null })}>
              <RotateCcw size={13} aria-hidden="true" />
              Use the whole {scene.kind === 'clip' ? 'clip' : 'card'}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-hair pt-3">
        {scene.kind === 'clip' ? (
          <>
            <button type="button" className={BTN_SOFT} onClick={() => onReplaceClip(scene)} disabled={busy}>
              <Replace size={14} aria-hidden="true" />
              Replace from the Gallery
            </button>
            {scene.status !== 'planned' && scene.status !== 'generating' && (
              <button type="button" className={BTN_SOFT} onClick={() => onRegenerate(scene)} disabled={busy}>
                <Sparkles size={14} aria-hidden="true" />
                Regenerate this scene
              </button>
            )}
          </>
        ) : (
          scene.template && (
            <button type="button" className={BTN_SOFT} onClick={() => onEditCard(scene, scene.template as TemplateFields)} disabled={busy}>
              <PenLine size={14} aria-hidden="true" />
              Edit the card
            </button>
          )
        )}
        <button type="button" className={BTN_SOFT_DANGER} onClick={onRemove} disabled={busy}>
          <Trash2 size={14} aria-hidden="true" />
          Remove
        </button>
      </div>
    </div>
  )
}
