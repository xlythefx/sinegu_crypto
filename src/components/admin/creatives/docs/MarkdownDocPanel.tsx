import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck, Eye, PenLine, RotateCcw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import DataState from '../../../dashboard/DataState'
import ConfirmModal from '../../../ui/ConfirmModal'
import Markdown from '../../../ui/Markdown'
import { Segmented } from '../../../ui/filters'
import { BTN_GHOST, BTN_PRIMARY } from '../../../settings/formClasses'
import { fmtDateTime } from '../../../../lib/format'
import { creativeErrorMessage } from '../../../../lib/creatives'
import SectionHeader from '../SectionHeader'
import { NOTICE, SECTION, TEXTAREA } from '../creativeClasses'

/** A saved Markdown document (the brief, the playbook). */
export interface MarkdownDoc {
  markdown: string
  updated_by_name: string | null
  updated_at: string | null
}

export interface MarkdownDocPanelProps {
  /** Heading id (aria-labelledby). */
  id: string
  icon: LucideIcon
  title: string
  subtitle: string
  /** "brief" / "playbook" — in sentences ("Could not save the brief."). */
  noun: string
  max: number
  doc: MarkdownDoc | null
  loading: boolean
  error: unknown
  reload: () => void
  save: (markdown: string) => Promise<MarkdownDoc>
  /** Unsaved edits — the workspace asks before the panel is closed or switched. */
  onDirtyChange: (dirty: boolean) => void
  /** Shown in Edit when the box is empty. */
  placeholder: string
  /** Shown in Preview when the document is empty. */
  emptyText: string
  /** Shown when nobody has edited it yet. */
  neverEdited: string
  saveLabel: string
}

type View = 'edit' | 'preview'

const VIEW_OPTIONS = [
  { value: 'preview' as const, label: 'Preview', icon: Eye },
  { value: 'edit' as const, label: 'Edit', icon: PenLine },
]

/**
 * One Markdown document the agent reads — the brand brief, the video
 * playbook. Preview first (it is mostly read); Edit is a plain Markdown box
 * with a character count. Unsaved edits are guarded: Revert asks first, and
 * the workspace asks before the panel closes. Everyone on the team may edit.
 */
export default function MarkdownDocPanel({
  id,
  icon,
  title,
  subtitle,
  noun,
  max: BRIEF_MAX,
  doc: brief,
  loading,
  error,
  reload,
  save,
  onDirtyChange,
  placeholder,
  emptyText,
  neverEdited,
  saveLabel,
}: MarkdownDocPanelProps) {
  const [text, setText] = useState<string | null>(null)
  const [view, setView] = useState<View>('preview')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [confirmRevert, setConfirmRevert] = useState(false)

  // Seed once; an empty brief opens straight in Edit.
  useEffect(() => {
    if (brief && text === null) {
      setText(brief.markdown)
      if (brief.markdown.trim() === '') setView('edit')
    }
  }, [brief, text])

  const value = text ?? ''
  const dirty = brief !== null && text !== null && text !== brief.markdown
  const tooLong = value.length > BRIEF_MAX

  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  // Leaving the page with unsaved edits asks the browser's own question.
  useEffect(() => {
    if (!dirty) return
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [dirty])

  if (!brief) {
    return <DataState loading={loading} error={error} onRetry={reload} label={noun} />
  }

  const onSave = async () => {
    if (!dirty || tooLong || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      const next = await save(value)
      setText(next.markdown)
      setSavedAt(Date.now())
    } catch (err) {
      setSaveError(creativeErrorMessage(err, `Could not save the ${noun}.`))
    } finally {
      setSaving(false)
    }
  }

  const edited =
    brief.updated_at && brief.updated_by_name
      ? `Last edited by ${brief.updated_by_name} on ${fmtDateTime(brief.updated_at)}.`
      : brief.updated_at
        ? `Last edited on ${fmtDateTime(brief.updated_at)}.`
        : neverEdited

  return (
    <section className={SECTION} aria-labelledby={id}>
      <SectionHeader icon={icon} id={id} title={title} subtitle={subtitle} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented value={view} onChange={setView} options={VIEW_OPTIONS} ariaLabel={`${title} view`} size="sm" />
        <span className={`font-mono text-[11px] tabular-nums ${tooLong ? 'font-semibold text-red' : 'text-faint'}`}>
          {value.length.toLocaleString()} / {BRIEF_MAX.toLocaleString()}
        </span>
      </div>

      <div key={view} className="animate-[fadeup_0.3s_ease-out]">
        {view === 'edit' ? (
          <label className="flex flex-col gap-1.5">
            <span className="sr-only">{title}, in Markdown</span>
            <textarea
              className={`${TEXTAREA} h-[min(58dvh,640px)] font-mono text-[12.5px] leading-[1.65]`}
              value={value}
              onChange={(e) => {
                setText(e.target.value)
                setSavedAt(null)
              }}
              spellCheck
              placeholder={placeholder}
            />
            <span className="text-[11.5px] leading-[1.5] text-faint">
              Markdown: # for a heading, - for a list, **bold**. Switch to Preview to see it as the agent’s notes.
            </span>
          </label>
        ) : value.trim() === '' ? (
          <p className="rounded-row border border-dashed border-border px-4 py-10 text-center text-[13px] leading-[1.6] text-muted">
            {emptyText}
          </p>
        ) : (
          <div className="rounded-row border border-hair bg-surface2/60 px-4 py-4 sm:px-5">
            <Markdown size="sm">{value}</Markdown>
          </div>
        )}
      </div>

      {tooLong && (
        <p className={NOTICE.error} role="alert">
          <CircleAlert size={15} aria-hidden="true" />
          The {noun} can be up to {BRIEF_MAX.toLocaleString()} characters. Shorten it before saving.
        </p>
      )}
      {saveError && (
        <p className={NOTICE.error} role="alert">
          <CircleAlert size={15} aria-hidden="true" />
          {saveError}
        </p>
      )}
      {savedAt && !dirty && (
        <p className={NOTICE.success} role="status">
          <CircleCheck size={15} aria-hidden="true" />
          Saved. The agent follows it from the next message.
        </p>
      )}

      <div className="flex flex-col gap-3 border-t border-hair pt-3.5">
        <p className="text-[12px] leading-[1.5] text-muted">{dirty ? 'You have changes that are not saved yet.' : edited}</p>
        <div className="flex flex-wrap justify-end gap-2.5">
          <button
            type="button"
            className={`${BTN_GHOST} disabled:cursor-not-allowed disabled:opacity-50`}
            onClick={() => setConfirmRevert(true)}
            disabled={!dirty || saving}
          >
            <RotateCcw size={14} aria-hidden="true" />
            Revert
          </button>
          <button type="button" className={BTN_PRIMARY} onClick={() => void onSave()} disabled={!dirty || tooLong || saving}>
            {saving ? 'Saving…' : saveLabel}
          </button>
        </div>
      </div>

      <ConfirmModal
        open={confirmRevert}
        title="Throw away your changes?"
        message={`The ${noun} goes back to the last saved version. What you changed since is lost.`}
        confirmLabel="Revert"
        cancelLabel="Keep editing"
        danger
        onConfirm={() => {
          setConfirmRevert(false)
          setText(brief.markdown)
          setSaveError(null)
        }}
        onCancel={() => setConfirmRevert(false)}
      />
    </section>
  )
}
