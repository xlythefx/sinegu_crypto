import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { CircleAlert, Eye, PenLine, Trash2 } from 'lucide-react'
import ConfirmModal from '../../../ui/ConfirmModal'
import Markdown from '../../../ui/Markdown'
import { Segmented } from '../../../ui/filters'
import { BTN_GHOST, BTN_PRIMARY, FIELD, HINT, INPUT, INPUT_MONO, LABEL, SELECT } from '../../../settings/formClasses'
import { STYLE_MARKDOWN_MAX } from '../../../../lib/creativesAgent'
import { ASPECTS, CAPTION_STYLES, ENGINES, MUSIC_PRESETS } from '../../../../lib/creativeVideos'
import { videoErrorMessage } from '../../../../lib/creativeVideos'
import type { CreativeStyle, CreativeStyleInput } from '../../../../types/creatives'
import CreativeModal from '../CreativeModal'
import ToggleSwitch from '../ToggleSwitch'
import { BTN_SOFT_DANGER, NOTICE, TEXTAREA } from '../creativeClasses'

interface StyleModalProps {
  open: boolean
  /** null = a new style. */
  style: CreativeStyle | null
  onClose: () => void
  onSave: (input: CreativeStyleInput) => Promise<void>
  onDelete?: () => Promise<void>
}

const SLUG_RE = /^[a-z0-9-]{3,40}$/

const BLANK: CreativeStyleInput = {
  slug: '',
  name: '',
  summary: '',
  markdown: '',
  default_platform: 'tiktok',
  default_aspect: '9:16',
  pixel_default: 'none',
  default_engine: 'kling',
  caption_style: 'bold',
  template_family: 'clean',
  music_default: 'none',
  pixel_look: false,
  enabled: true,
  sort: 0,
}

function fromStyle(s: CreativeStyle): CreativeStyleInput {
  const { id: _id, updated_by_name: _by, updated_at: _at, ...rest } = s
  return rest
}

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className={FIELD}>
      <span className={LABEL}>{label}</span>
      {children}
      {hint && <span className={HINT}>{hint}</span>}
    </label>
  )
}

/**
 * Create or edit one marketing style: what the agent reads when it picks a
 * look (name, one-line summary, the Markdown rules) and the defaults a new
 * video gets from it (platform, shape, how much Pixel, engine, captions,
 * templates, music, Pixel look). Closing with unsaved changes asks first;
 * deleting asks first (and the API refuses while a video uses the style).
 */
export default function StyleModal({ open, style, onClose, onSave, onDelete }: StyleModalProps) {
  const initial = useMemo(() => (style ? fromStyle(style) : BLANK), [style])
  const [form, setForm] = useState<CreativeStyleInput>(initial)
  const [slugTouched, setSlugTouched] = useState(false)
  const [view, setView] = useState<'edit' | 'preview'>('edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(initial)
    setSlugTouched(!!style)
    setView(style?.markdown ? 'preview' : 'edit')
    setError(null)
  }, [open, initial, style])

  const set = <K extends keyof CreativeStyleInput>(key: K, value: CreativeStyleInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const problem = !form.name.trim()
    ? 'Give the style a name.'
    : !SLUG_RE.test(form.slug)
      ? 'The short name must be 3–40 lowercase letters, numbers or dashes.'
      : form.summary.length > 200
        ? 'Keep the summary to 200 characters.'
        : form.markdown.length > STYLE_MARKDOWN_MAX
          ? `The rules can be up to ${STYLE_MARKDOWN_MAX.toLocaleString()} characters.`
          : null

  const close = () => (dirty ? setConfirmDiscard(true) : onClose())

  const submit = async () => {
    if (problem || saving) return
    setSaving(true)
    setError(null)
    try {
      await onSave({ ...form, name: form.name.trim(), summary: form.summary.trim() })
      onClose()
    } catch (err) {
      setError(videoErrorMessage(err, 'Could not save the style.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <CreativeModal
        open={open}
        title={style ? `Edit “${style.name}”` : 'New style'}
        subtitle="A style is a look a video can come out in. The agent reads the summary to choose one, then follows its rules."
        onClose={close}
        maxWidth={720}
      >
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <input
                className={INPUT}
                value={form.name}
                maxLength={80}
                onChange={(e) => {
                  set('name', e.target.value)
                  if (!slugTouched) set('slug', slugify(e.target.value))
                }}
                placeholder="Pixel arcade"
              />
            </Field>
            <Field label="Short name" hint="What the agent calls it — lowercase, numbers and dashes.">
              <input
                className={INPUT_MONO}
                value={form.slug}
                maxLength={40}
                onChange={(e) => {
                  setSlugTouched(true)
                  set('slug', e.target.value.toLowerCase())
                }}
                placeholder="pixel-arcade"
              />
            </Field>
          </div>

          <Field label="Summary" hint={`One line the agent reads when it picks a style · ${form.summary.length} / 200`}>
            <input
              className={INPUT}
              value={form.summary}
              maxLength={200}
              onChange={(e) => set('summary', e.target.value)}
              placeholder="8-bit arcade world, HIGH SCORE card for the week’s %, chiptune and coin sounds"
            />
          </Field>

          <fieldset className="flex flex-col gap-4 rounded-row border border-hair bg-surface2/50 p-3.5 sm:p-4">
            <legend className="px-1.5 text-[12px] font-bold text-muted">What a new video starts with</legend>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Platform">
                <select className={SELECT} value={form.default_platform} onChange={(e) => set('default_platform', e.target.value as CreativeStyleInput['default_platform'])}>
                  <option value="tiktok">TikTok</option>
                  <option value="x">X</option>
                  <option value="any">Either</option>
                </select>
              </Field>
              <Field label="Shape">
                <select className={SELECT} value={form.default_aspect} onChange={(e) => set('default_aspect', e.target.value as CreativeStyleInput['default_aspect'])}>
                  {ASPECTS.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.label} — {a.hint}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Pixel">
                <select className={SELECT} value={form.pixel_default} onChange={(e) => set('pixel_default', e.target.value as CreativeStyleInput['pixel_default'])}>
                  <option value="none">Not in it</option>
                  <option value="cameo">A cameo (one scene)</option>
                  <option value="lead">The lead</option>
                </select>
              </Field>
              <Field label="Engine">
                <select className={SELECT} value={form.default_engine} onChange={(e) => set('default_engine', e.target.value as CreativeStyleInput['default_engine'])}>
                  {ENGINES.map((en) => (
                    <option key={en.key} value={en.key}>
                      {en.label} — {en.sound ? 'with sound' : 'silent'}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Captions">
                <select className={SELECT} value={form.caption_style} onChange={(e) => set('caption_style', e.target.value as CreativeStyleInput['caption_style'])}>
                  {CAPTION_STYLES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Template cards">
                <select className={SELECT} value={form.template_family} onChange={(e) => set('template_family', e.target.value as CreativeStyleInput['template_family'])}>
                  <option value="clean">Clean</option>
                  <option value="pixel">Pixel (8-bit)</option>
                </select>
              </Field>
              <Field label="Music">
                <select className={SELECT} value={form.music_default} onChange={(e) => set('music_default', e.target.value as CreativeStyleInput['music_default'])}>
                  <option value="none">None</option>
                  {MUSIC_PRESETS.map((m) => (
                    <option key={m.key} value={m.key}>
                      Chiptune · {m.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Order" hint="Lower comes first.">
                <input className={INPUT} type="number" min={0} max={999} value={form.sort} onChange={(e) => set('sort', Number(e.target.value) || 0)} />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-text">
                <ToggleSwitch on={form.pixel_look} onChange={(v) => set('pixel_look', v)} label="Pixel look (pixelate + scanlines)" showState={false} />
                Pixel look (pixelate + scanlines)
              </span>
              <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-text">
                <ToggleSwitch on={form.enabled} onChange={(v) => set('enabled', v)} label="Offered to the agent" showState={false} />
                Offered to the agent
              </span>
            </div>
          </fieldset>

          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className={LABEL}>The style’s rules (Markdown)</span>
              <div className="flex items-center gap-3">
                <span className={`font-mono text-[11px] tabular-nums ${form.markdown.length > STYLE_MARKDOWN_MAX ? 'font-semibold text-red' : 'text-faint'}`}>
                  {form.markdown.length.toLocaleString()} / {STYLE_MARKDOWN_MAX.toLocaleString()}
                </span>
                <Segmented
                  value={view}
                  onChange={setView}
                  size="sm"
                  ariaLabel="Rules view"
                  options={[
                    { value: 'edit', label: 'Edit', icon: PenLine },
                    { value: 'preview', label: 'Preview', icon: Eye },
                  ]}
                />
              </div>
            </div>
            {view === 'edit' ? (
              <textarea
                className={`${TEXTAREA} h-[min(40dvh,360px)] font-mono text-[12.5px] leading-[1.65]`}
                value={form.markdown}
                onChange={(e) => set('markdown', e.target.value)}
                placeholder={'## Look\n- 8-bit pixel-art world\n\n## Scenes\n- Open on a HIGH SCORE card with the week’s figure'}
              />
            ) : form.markdown.trim() ? (
              <div className="max-h-[min(40dvh,360px)] overflow-y-auto rounded-row border border-hair bg-surface2/60 px-4 py-4">
                <Markdown size="sm">{form.markdown}</Markdown>
              </div>
            ) : (
              <p className="rounded-row border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted">
                No rules yet. Switch to Edit and write how this style looks and sounds.
              </p>
            )}
          </div>

          {(error || (problem && dirty)) && (
            <p className={NOTICE.error} role="alert">
              <CircleAlert size={15} aria-hidden="true" />
              {error ?? problem}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2.5 border-t border-hair pt-4 sm:flex-row sm:items-center">
            {onDelete && (
              <button type="button" className={`${BTN_SOFT_DANGER} sm:mr-auto`} onClick={() => setConfirmDelete(true)} disabled={saving}>
                <Trash2 size={14} aria-hidden="true" />
                Delete style
              </button>
            )}
            <div className="flex flex-col-reverse gap-2.5 sm:ml-auto sm:flex-row">
              <button type="button" className={BTN_GHOST} onClick={close} disabled={saving}>
                Cancel
              </button>
              <button type="button" className={BTN_PRIMARY} onClick={() => void submit()} disabled={!!problem || saving || (!dirty && !!style)}>
                {saving ? 'Saving…' : style ? 'Save style' : 'Create style'}
              </button>
            </div>
          </div>
        </div>
      </CreativeModal>

      <ConfirmModal
        open={confirmDiscard}
        title="Close without saving?"
        message="Your changes to this style are not saved. Close now and they are lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        danger
        onConfirm={() => {
          setConfirmDiscard(false)
          onClose()
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
      <ConfirmModal
        open={confirmDelete}
        title={`Delete “${style?.name ?? 'this style'}”?`}
        message="The agent can no longer pick it. Video projects that already used it keep their look. A style still used by a project can’t be deleted — switch it off instead."
        confirmLabel="Delete"
        cancelLabel="Keep it"
        danger
        onConfirm={() => {
          setConfirmDelete(false)
          if (!onDelete) return
          setSaving(true)
          onDelete()
            .then(onClose)
            .catch((err) => setError(videoErrorMessage(err, 'Could not delete the style.')))
            .finally(() => setSaving(false))
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
