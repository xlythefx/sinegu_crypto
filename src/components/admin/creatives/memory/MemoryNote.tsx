import { useState } from 'react'
import { Bot, CircleAlert, Pencil, Trash2, UserRound } from 'lucide-react'
import { BTN_GHOST_SM, BTN_PRIMARY_SM, ICON_BTN, ICON_BTN_DANGER, SELECT } from '../../../settings/formClasses'
import { fmtDateTime } from '../../../../lib/format'
import { creativeErrorMessage } from '../../../../lib/creatives'
import { MEMORY_CATEGORIES, MEMORY_TEXT_MAX, memoryCategory } from '../../../../lib/creativesAgent'
import type { CreativeMemory, CreativeMemoryCategory, CreativeMemoryInput } from '../../../../types/creatives'
import { NOTICE, TEXTAREA } from '../creativeClasses'

interface MemoryNoteProps {
  memory: CreativeMemory
  onSave: (id: number, patch: Partial<CreativeMemoryInput>) => Promise<unknown>
  /** Asks first (the panel's ConfirmModal). */
  onDelete: (memory: CreativeMemory) => void
}

/**
 * One memory note: its words, who saved it (the agent in a chat, or a person
 * here) and when. Edit opens it in place — words and category — and Save
 * sends only what changed.
 */
export default function MemoryNote({ memory, onSave, onDelete }: MemoryNoteProps) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(memory.text)
  const [category, setCategory] = useState<CreativeMemoryCategory>(memoryCategory(memory.category))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startEdit = () => {
    setText(memory.text)
    setCategory(memoryCategory(memory.category))
    setError(null)
    setEditing(true)
  }

  const save = async () => {
    const clean = text.trim()
    if (clean === '') {
      setError('A note needs some words. To remove it, delete it instead.')
      return
    }
    const patch: Partial<CreativeMemoryInput> = {}
    if (clean !== memory.text) patch.text = clean
    if (category !== memoryCategory(memory.category)) patch.category = category
    if (Object.keys(patch).length === 0) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(memory.id, patch)
      setEditing(false)
    } catch (err) {
      setError(creativeErrorMessage(err, 'Could not save the note.'))
    } finally {
      setSaving(false)
    }
  }

  const by = memory.source === 'agent' ? 'Saved by the agent' : `Added by ${memory.created_by_name ?? 'someone on the team'}`
  const SourceIcon = memory.source === 'agent' ? Bot : UserRound

  return (
    <li className="flex min-w-0 flex-col gap-2.5 rounded-row border border-border bg-surface2 px-3.5 py-3">
      {editing ? (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="sr-only">Note</span>
            <textarea
              className={`${TEXTAREA} min-h-[72px]`}
              value={text}
              maxLength={MEMORY_TEXT_MAX}
              onChange={(e) => setText(e.target.value)}
              autoFocus
              disabled={saving}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="min-w-[150px] flex-1">
              <span className="sr-only">Category</span>
              <select
                className={SELECT}
                value={category}
                onChange={(e) => setCategory(e.target.value as CreativeMemoryCategory)}
                disabled={saving}
              >
                {MEMORY_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <span className="font-mono text-[11px] tabular-nums text-faint">
              {text.length} / {MEMORY_TEXT_MAX}
            </span>
          </div>
          {error && (
            <p className={NOTICE.error} role="alert">
              <CircleAlert size={15} aria-hidden="true" />
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className={BTN_GHOST_SM} onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
            <button type="button" className={BTN_PRIMARY_SM} onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save note'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex min-w-0 items-start gap-2">
            <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[13px] leading-[1.6] text-text">{memory.text}</p>
            <div className="-mr-1 -mt-0.5 flex flex-none items-center gap-0.5">
              <button type="button" className={`${ICON_BTN} h-9 w-9`} onClick={startEdit} aria-label="Edit this note">
                <Pencil size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`${ICON_BTN_DANGER} h-9 w-9`}
                onClick={() => onDelete(memory)}
                aria-label="Delete this note"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-faint">
            <span className="inline-flex items-center gap-1">
              <SourceIcon size={12} aria-hidden="true" className="flex-none" />
              {by}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {memory.updated_by_name ? `edited by ${memory.updated_by_name}, ` : ''}
              {fmtDateTime(memory.updated_at)}
            </span>
          </p>
        </>
      )}
    </li>
  )
}
