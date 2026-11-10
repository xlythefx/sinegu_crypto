import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CircleAlert, Clapperboard, Sparkles, Trash2 } from 'lucide-react'
import ConfirmModal from '../../../ui/ConfirmModal'
import { Segmented } from '../../../ui/filters'
import { BTN_GHOST, BTN_PRIMARY, FIELD, HINT, INPUT, LABEL, SELECT } from '../../../settings/formClasses'
import { usePlanAiDraft } from '../../../../hooks/usePlanAiDraft'
import { fmtDateTime } from '../../../../lib/format'
import { creativeErrorMessage, FORMAT_KEYS, FORMAT_LABEL, PLAN_STAGES, PLATFORM_KEYS, PLATFORM_LABEL } from '../../../../lib/creatives'
import {
  joinFields,
  makeLabel,
  STUDIO_PROMPT_MAX,
  VIDEO_PROMPT_MAX,
  type DraftField,
} from '../../../../lib/creativesAi'
import { createCreativePlan, deleteCreativePlan, updateCreativePlan } from '../../../../services/creatives'
import type {
  CreativeAiMeta,
  CreativeBudget,
  CreativeFormat,
  CreativePlan,
  CreativePlanInput,
  CreativePlanStatus,
  CreativePlatform,
} from '../../../../types/creatives'
import CreativeModal from '../CreativeModal'
import AiDraftPanel from '../ai/AiDraftPanel'
import { BTN_SOFT_DANGER, NOTICE, TEXTAREA } from '../creativeClasses'
import { FORMAT_ICON } from '../creativeIcons'

/**
 * What "New plan" starts from — the column it was opened in, the platform
 * filter, or a suggested idea ("Write it": its title, shape and a brief).
 */
export interface PlanDefaults {
  status?: CreativePlanStatus
  platform?: CreativePlatform
  format?: CreativeFormat
  title?: string
  /** The AI writer's idea box starts with this instead of following the title. */
  brief?: string
}

interface PlanModalProps {
  open: boolean
  /** null = a new plan. */
  plan: CreativePlan | null
  defaults?: PlanDefaults
  /** The AI writer on this server (Claude). */
  ai: CreativeAiMeta
  budget: CreativeBudget
  /** AI writing is paid from the month's cap — every answer carries the new figure. */
  onBudget: (budget: CreativeBudget) => void
  onClose: () => void
  onSaved: (plan: CreativePlan) => void
  onDeleted: (id: number) => void
  /** Jump to Studio with this plan picked (its video prompt fills the Studio's). */
  onGenerate: (planId: number) => void
}

type FormState = Record<
  'title' | 'planned_for' | 'hook' | 'script' | 'caption' | 'hashtags' | 'notes' | 'posted_url' | 'video_prompt',
  string
> & { status: CreativePlanStatus; platform: CreativePlatform; format: CreativeFormat }

function formFrom(plan: CreativePlan | null, defaults: PlanDefaults = {}): FormState {
  return {
    title: plan?.title ?? defaults.title ?? '',
    status: plan?.status ?? defaults.status ?? 'idea',
    platform: plan?.platform ?? defaults.platform ?? 'tiktok',
    format: plan?.format ?? defaults.format ?? 'video',
    planned_for: plan?.planned_for ?? '',
    hook: plan?.hook ?? '',
    script: plan?.script ?? '',
    caption: plan?.caption ?? '',
    hashtags: plan?.hashtags ?? '',
    notes: plan?.notes ?? '',
    posted_url: plan?.posted_url ?? '',
    video_prompt: plan?.video_prompt ?? '',
  }
}

/** The six fields a draft fills, as they stand. */
function draftFields(f: FormState): Record<DraftField, string> {
  return {
    title: f.title,
    hook: f.hook,
    script: f.script,
    caption: f.caption,
    hashtags: f.hashtags,
    video_prompt: f.video_prompt,
  }
}

/** Blank optional text is sent as null, so a cleared field is cleared on the server too. */
function toInput(f: FormState): CreativePlanInput {
  const opt = (v: string) => (v.trim() === '' ? null : v.trim())
  return {
    title: f.title.trim(),
    status: f.status,
    platform: f.platform,
    format: f.format,
    planned_for: f.planned_for || null,
    hook: opt(f.hook),
    script: opt(f.script),
    caption: opt(f.caption),
    hashtags: opt(f.hashtags),
    notes: opt(f.notes),
    posted_url: opt(f.posted_url),
    video_prompt: opt(f.video_prompt),
  }
}

const PLATFORM_OPTIONS = PLATFORM_KEYS.map((k) => ({ value: k, label: PLATFORM_LABEL[k] }))
const FORMAT_OPTIONS = FORMAT_KEYS.map((k) => ({ value: k, label: FORMAT_LABEL[k], icon: FORMAT_ICON[k] }))

/**
 * Create or edit one content plan: what it is, where it goes, when, and the
 * words (hook, script, caption, hashtags, video prompt). "Write it for me" at
 * the top lets Claude draft all of them from a short idea — the fields lock
 * while it writes, and text someone wrote is only replaced after a ConfirmModal.
 * Delete is confirmed and says that the plan's generations keep their records.
 */
export default function PlanModal({
  open,
  plan,
  defaults,
  ai,
  budget,
  onBudget,
  onClose,
  onSaved,
  onDeleted,
  onGenerate,
}: PlanModalProps) {
  const [form, setForm] = useState<FormState>(() => formFrom(plan, defaults))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  // Seed the fields every time the modal opens (or switches to another plan).
  useEffect(() => {
    if (!open) return
    setForm(formFrom(plan, defaults))
    setError(null)
    setSaving(false)
    setConfirmDelete(false)
    setConfirmLeave(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plan?.id])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const applyFields = useCallback((patch: Record<DraftField, string>) => setForm((f) => ({ ...f, ...patch })), [])
  const appendNote = useCallback(
    (text: string) => setForm((f) => ({ ...f, notes: f.notes.trim() ? `${f.notes.trimEnd()}\n\n${text}` : text })),
    [],
  )
  const aiDraft = usePlanAiDraft({
    open,
    planId: plan?.id ?? null,
    platform: form.platform,
    format: form.format,
    fields: draftFields(form),
    seedBrief: plan ? null : (defaults?.brief ?? null),
    seededTitle: plan ? null : (defaults?.title ?? null),
    applyFields,
    appendNote,
    onBudget,
  })
  const writing = aiDraft.call.busy

  const input = toInput(form)
  const dirty = plan === null || JSON.stringify(input) !== JSON.stringify(toInput(formFrom(plan)))

  // Closing mid-draft throws away a paid answer — ask first.
  const close = () => (writing ? setConfirmLeave(true) : onClose())

  const save = async (thenGenerate: boolean) => {
    if (writing) return
    if (input.title === '') {
      setError('Give the plan a title.')
      return
    }
    if (!dirty && plan) {
      if (thenGenerate) onGenerate(plan.id)
      else onClose()
      return
    }
    setSaving(true)
    setError(null)
    // Words from a draft are marked once on the server (`ai_drafted_at`), for the card's "AI draft" pill.
    const body: CreativePlanInput = aiDraft.drafted ? { ...input, ai_drafted: true } : input
    try {
      const saved = plan ? await updateCreativePlan(plan.id, body) : await createCreativePlan(body)
      onSaved(saved)
      if (thenGenerate) onGenerate(saved.id)
      else onClose()
    } catch (err) {
      setError(creativeErrorMessage(err, 'Could not save the plan.'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!plan) return
    setConfirmDelete(false)
    setSaving(true)
    setError(null)
    try {
      await deleteCreativePlan(plan.id)
      onDeleted(plan.id)
      onClose()
    } catch (err) {
      setError(creativeErrorMessage(err, 'Could not delete the plan.'))
      setSaving(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void save(false)
  }

  const count = plan?.generations_count ?? 0
  const deleteMessage =
    count > 0
      ? `The plan is removed for good. Its ${count === 1 ? 'generated image or video keeps its record' : `${count} generated images and videos keep their records`} in Studio — prompt, cost and who made it — just no longer linked to a plan.`
      : 'The plan is removed for good. This cannot be undone.'

  const hasPrompt = form.video_prompt.trim() !== ''
  const promptTooLong = form.video_prompt.trim().length > STUDIO_PROMPT_MAX
  const make = makeLabel(form.format)
  const generateLabel = hasPrompt
    ? dirty
      ? `Save and ${make.charAt(0).toLowerCase()}${make.slice(1)}`
      : make
    : dirty
      ? 'Save and generate'
      : 'Generate for this plan'
  const confirming = confirmDelete || confirmLeave || aiDraft.replacing !== null || aiDraft.undoAsked

  return (
    <CreativeModal
      open={open}
      title={plan ? 'Edit plan' : 'New plan'}
      subtitle={
        plan
          ? `Created${plan.created_by_name ? ` by ${plan.created_by_name}` : ''} · last edited ${fmtDateTime(plan.updated_at)}${plan.updated_by_name ? ` by ${plan.updated_by_name}` : ''}${plan.ai_drafted_at ? ' · drafted with AI' : ''}`
          : 'An X or TikTok post, from first idea to posted.'
      }
      // While a confirmation is up, Escape belongs to it alone.
      onClose={confirming ? () => {} : close}
      maxWidth={680}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <AiDraftPanel
          ai={ai}
          state={aiDraft}
          platform={form.platform}
          format={form.format}
          budget={budget}
          defaultOpen={!plan || !(plan.hook || plan.script || plan.caption)}
        />

        {/* Locked while Claude writes: the draft is about to fill these, and typing would be lost. */}
        <fieldset
          disabled={writing}
          aria-busy={writing}
          className={`m-0 flex min-w-0 flex-col gap-4 border-0 p-0 transition-opacity duration-150 ${writing ? 'opacity-55' : ''}`}
        >
          <label className={FIELD}>
            <span className={LABEL}>Title</span>
            <input
              className={INPUT}
              value={form.title}
              maxLength={160}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. “What the bot did this week” recap"
              autoFocus={plan === null && !ai.configured}
              required
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className={FIELD}>
              <span className={LABEL}>Platform</span>
              <Segmented
                value={form.platform}
                onChange={(v) => set('platform', v)}
                options={PLATFORM_OPTIONS}
                ariaLabel="Platform"
              />
            </div>
            <div className={FIELD}>
              <span className={LABEL}>Format</span>
              <Segmented value={form.format} onChange={(v) => set('format', v)} options={FORMAT_OPTIONS} ariaLabel="Format" />
            </div>
            <label className={FIELD}>
              <span className={LABEL}>Planned for</span>
              <input
                type="date"
                className={INPUT}
                value={form.planned_for}
                onChange={(e) => set('planned_for', e.target.value)}
              />
            </label>
            <label className={FIELD}>
              <span className={LABEL}>Stage</span>
              <select
                className={SELECT}
                value={form.status}
                onChange={(e) => set('status', e.target.value as CreativePlanStatus)}
              >
                {PLAN_STAGES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className={FIELD}>
            <span className={LABEL}>Hook</span>
            <textarea
              className={`${TEXTAREA} min-h-[64px]`}
              rows={2}
              value={form.hook}
              onChange={(e) => set('hook', e.target.value)}
              placeholder="The first line or second that stops the scroll."
            />
          </label>
          <label className={FIELD}>
            <span className={LABEL}>Script</span>
            <textarea
              className={`${TEXTAREA} min-h-[140px]`}
              rows={6}
              value={form.script}
              onChange={(e) => set('script', e.target.value)}
              placeholder="What happens, scene by scene, and what is said."
            />
          </label>
          <label className={FIELD}>
            <span className={LABEL}>Caption</span>
            <textarea
              className={TEXTAREA}
              rows={3}
              value={form.caption}
              onChange={(e) => set('caption', e.target.value)}
              placeholder="The text that goes with the post."
            />
          </label>
          <label className={FIELD}>
            <span className={LABEL}>Hashtags</span>
            <input
              className={INPUT}
              value={form.hashtags}
              maxLength={500}
              onChange={(e) => set('hashtags', e.target.value)}
              placeholder="#crypto #tradingbot #pixelalpha"
            />
          </label>
          <label className={FIELD}>
            <span className={LABEL}>Video prompt</span>
            <textarea
              className={`${TEXTAREA} min-h-[100px]`}
              rows={4}
              value={form.video_prompt}
              maxLength={VIDEO_PROMPT_MAX}
              onChange={(e) => set('video_prompt', e.target.value)}
              placeholder="What happens on screen, for the Studio — e.g. Pixel at a glowing trading desk, charts ticking up behind it, slow push-in."
            />
            <span className={promptTooLong ? `${HINT} font-semibold text-red` : HINT}>
              {promptTooLong
                ? `The Studio takes up to ${STUDIO_PROMPT_MAX.toLocaleString()} characters — shorten this before you make it.`
                : `“${make}” opens the Studio with this filled in. Pixel’s look is added there, so describe the scene, not the character.`}
            </span>
          </label>
          <label className={FIELD}>
            <span className={LABEL}>Notes</span>
            <textarea
              className={TEXTAREA}
              rows={3}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Anything the team should know."
            />
          </label>
          <label className={FIELD}>
            <span className={LABEL}>Posted link</span>
            <input
              type="url"
              inputMode="url"
              className={INPUT}
              value={form.posted_url}
              maxLength={500}
              onChange={(e) => set('posted_url', e.target.value)}
              placeholder="https://"
            />
            <span className={HINT}>Paste the post’s link once it is live, so everyone can find it.</span>
          </label>
        </fieldset>

        {error && (
          <p className={NOTICE.error} role="alert">
            <CircleAlert size={15} aria-hidden="true" />
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-hair pt-4 sm:flex-row sm:flex-wrap sm:items-center">
          {plan && (
            <button
              type="button"
              className={`${BTN_SOFT_DANGER} sm:mr-auto`}
              onClick={() => setConfirmDelete(true)}
              disabled={saving || writing}
            >
              <Trash2 size={14} aria-hidden="true" />
              Delete plan
            </button>
          )}
          <div className="flex flex-wrap justify-end gap-2.5 sm:ml-auto">
            <button
              type="button"
              className={`${BTN_GHOST} disabled:cursor-not-allowed disabled:opacity-50`}
              onClick={() => void save(true)}
              disabled={saving || writing}
            >
              {hasPrompt ? <Clapperboard size={14} aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
              {generateLabel}
            </button>
            <button type="button" className={BTN_GHOST} onClick={close} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className={BTN_PRIMARY} disabled={saving || writing}>
              {saving ? 'Saving…' : plan ? 'Save changes' : 'Create plan'}
            </button>
          </div>
        </div>
      </form>

      <ConfirmModal
        open={confirmDelete}
        title={`Delete “${plan?.title ?? ''}”?`}
        message={deleteMessage}
        confirmLabel="Delete plan"
        cancelLabel="Keep it"
        danger
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmModal
        open={aiDraft.replacing !== null}
        title="Replace what’s there with the AI draft?"
        message={
          aiDraft.replacing
            ? `Claude’s draft replaces ${joinFields(aiDraft.replacing)} you have now. You can put them back afterwards with “Put back what was there”. Writing costs a few cents from this month’s budget.`
            : undefined
        }
        confirmLabel="Replace with the draft"
        cancelLabel="Keep mine"
        onConfirm={aiDraft.confirmReplace}
        onCancel={aiDraft.cancelReplace}
      />

      <ConfirmModal
        open={aiDraft.undoAsked}
        title="Put back what was there?"
        message="The title, hook, script, caption, hashtags and video prompt go back to what they were before this draft. Anything you changed in them since is lost too."
        confirmLabel="Put it back"
        cancelLabel="Keep the draft"
        onConfirm={aiDraft.confirmUndo}
        onCancel={aiDraft.cancelUndo}
      />

      <ConfirmModal
        open={confirmLeave}
        title="Close while Claude is writing?"
        message="The draft is already being paid for (a few cents), and it is lost if you close now. It usually takes under 40 seconds."
        confirmLabel="Close anyway"
        cancelLabel="Keep waiting"
        danger
        onConfirm={() => {
          setConfirmLeave(false)
          aiDraft.call.reset()
          onClose()
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </CreativeModal>
  )
}
