import { useEffect, useState, type FormEvent } from 'react'
import { CircleAlert, Sparkles, Trash2 } from 'lucide-react'
import ConfirmModal from '../../../ui/ConfirmModal'
import { Segmented } from '../../../ui/filters'
import { BTN_GHOST, BTN_PRIMARY, FIELD, HINT, INPUT, LABEL, SELECT } from '../../../settings/formClasses'
import { fmtDateTime } from '../../../../lib/format'
import { creativeErrorMessage, FORMAT_KEYS, FORMAT_LABEL, PLAN_STAGES, PLATFORM_KEYS, PLATFORM_LABEL } from '../../../../lib/creatives'
import { createCreativePlan, deleteCreativePlan, updateCreativePlan } from '../../../../services/creatives'
import type {
  CreativeFormat,
  CreativePlan,
  CreativePlanInput,
  CreativePlanStatus,
  CreativePlatform,
} from '../../../../types/creatives'
import CreativeModal from '../CreativeModal'
import { BTN_SOFT_DANGER, NOTICE, TEXTAREA } from '../creativeClasses'
import { FORMAT_ICON } from '../creativeIcons'

/** What "New plan" starts from — the column it was opened in, the platform filter. */
export interface PlanDefaults {
  status?: CreativePlanStatus
  platform?: CreativePlatform
}

interface PlanModalProps {
  open: boolean
  /** null = a new plan. */
  plan: CreativePlan | null
  defaults?: PlanDefaults
  onClose: () => void
  onSaved: (plan: CreativePlan) => void
  onDeleted: (id: number) => void
  /** Jump to Studio with this plan picked. */
  onGenerate: (planId: number) => void
}

type FormState = Record<
  'title' | 'planned_for' | 'hook' | 'script' | 'caption' | 'hashtags' | 'notes' | 'posted_url',
  string
> & { status: CreativePlanStatus; platform: CreativePlatform; format: CreativeFormat }

function formFrom(plan: CreativePlan | null, defaults: PlanDefaults = {}): FormState {
  return {
    title: plan?.title ?? '',
    status: plan?.status ?? defaults.status ?? 'idea',
    platform: plan?.platform ?? defaults.platform ?? 'tiktok',
    format: plan?.format ?? 'video',
    planned_for: plan?.planned_for ?? '',
    hook: plan?.hook ?? '',
    script: plan?.script ?? '',
    caption: plan?.caption ?? '',
    hashtags: plan?.hashtags ?? '',
    notes: plan?.notes ?? '',
    posted_url: plan?.posted_url ?? '',
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
  }
}

const PLATFORM_OPTIONS = PLATFORM_KEYS.map((k) => ({ value: k, label: PLATFORM_LABEL[k] }))
const FORMAT_OPTIONS = FORMAT_KEYS.map((k) => ({ value: k, label: FORMAT_LABEL[k], icon: FORMAT_ICON[k] }))

/**
 * Create or edit one content plan: what it is, where it goes, when, and the
 * words (hook, script, caption, hashtags). Delete is confirmed and says that
 * the plan's generations keep their records.
 */
export default function PlanModal({ open, plan, defaults, onClose, onSaved, onDeleted, onGenerate }: PlanModalProps) {
  const [form, setForm] = useState<FormState>(() => formFrom(plan, defaults))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Seed the fields every time the modal opens (or switches to another plan).
  useEffect(() => {
    if (!open) return
    setForm(formFrom(plan, defaults))
    setError(null)
    setSaving(false)
    setConfirmDelete(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plan?.id])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const input = toInput(form)
  const dirty = plan === null || JSON.stringify(input) !== JSON.stringify(toInput(formFrom(plan)))

  const save = async (thenGenerate: boolean) => {
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
    try {
      const saved = plan ? await updateCreativePlan(plan.id, input) : await createCreativePlan(input)
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

  return (
    <CreativeModal
      open={open}
      title={plan ? 'Edit plan' : 'New plan'}
      subtitle={
        plan
          ? `Created${plan.created_by_name ? ` by ${plan.created_by_name}` : ''} · last edited ${fmtDateTime(plan.updated_at)}${plan.updated_by_name ? ` by ${plan.updated_by_name}` : ''}`
          : 'An X or TikTok post, from first idea to posted.'
      }
      // While the delete confirmation is up, Escape belongs to it alone.
      onClose={confirmDelete ? () => {} : onClose}
      maxWidth={680}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className={FIELD}>
          <span className={LABEL}>Title</span>
          <input
            className={INPUT}
            value={form.title}
            maxLength={160}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. “What the bot did this week” recap"
            autoFocus={plan === null}
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
              disabled={saving}
            >
              <Trash2 size={14} aria-hidden="true" />
              Delete plan
            </button>
          )}
          <div className="flex flex-wrap justify-end gap-2.5 sm:ml-auto">
            <button type="button" className={BTN_GHOST} onClick={() => void save(true)} disabled={saving}>
              <Sparkles size={14} aria-hidden="true" />
              {dirty ? 'Save and generate' : 'Generate for this plan'}
            </button>
            <button type="button" className={BTN_GHOST} onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className={BTN_PRIMARY} disabled={saving}>
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
    </CreativeModal>
  )
}
