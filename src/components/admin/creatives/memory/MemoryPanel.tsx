import { useState, type FormEvent } from 'react'
import { Brain, CircleAlert, Plus } from 'lucide-react'
import DataState from '../../../dashboard/DataState'
import ConfirmModal from '../../../ui/ConfirmModal'
import { BTN_PRIMARY, SELECT } from '../../../settings/formClasses'
import { useCreativeMemories } from '../../../../hooks/useCreativeMemories'
import { creativeErrorMessage } from '../../../../lib/creatives'
import { MEMORY_CATEGORIES, MEMORY_TEXT_MAX, memoryCategory } from '../../../../lib/creativesAgent'
import type { CreativeMemory, CreativeMemoryCategory } from '../../../../types/creatives'
import SectionHeader from '../SectionHeader'
import { NOTICE, SECTION, TEXTAREA } from '../creativeClasses'
import MemoryNote from './MemoryNote'

interface MemoryPanelProps {
  /** Goes up when the agent saved or changed a note in the chat. */
  reloadSignal: number
}

/** The first words of a note, for the delete question. */
function excerpt(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ').replace(/[.!?\s]+$/, '')
  return t.length > 90 ? `${t.slice(0, 89).trimEnd()}…` : t
}

/**
 * The team's memory: notes the agent keeps across chats (the chats themselves
 * are not kept — decisions live here, in the Brief and in the Plans). Grouped
 * by category; anyone on the team may add, edit or delete one, and the agent
 * saves them when someone asks it to remember something.
 */
export default function MemoryPanel({ reloadSignal }: MemoryPanelProps) {
  const { memories, loading, error, reload, add, update, remove } = useCreativeMemories(reloadSignal)
  const [text, setText] = useState('')
  const [category, setCategory] = useState<CreativeMemoryCategory>('brand')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<CreativeMemory | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const clean = text.trim()
    if (clean === '' || adding) return
    setAdding(true)
    setAddError(null)
    try {
      await add({ text: clean, category })
      setText('')
    } catch (err) {
      setAddError(creativeErrorMessage(err, 'Could not add the note.'))
    } finally {
      setAdding(false)
    }
  }

  const confirmDelete = async () => {
    const target = deleting
    setDeleting(null)
    if (!target) return
    setDeleteError(null)
    try {
      await remove(target.id)
    } catch (err) {
      setDeleteError(creativeErrorMessage(err, 'Could not delete the note.'))
    }
  }

  const groups = MEMORY_CATEGORIES.map((c) => ({
    ...c,
    items: (memories ?? []).filter((m) => memoryCategory(m.category) === c.key),
  })).filter((g) => g.items.length > 0)

  return (
    <section className={SECTION} aria-labelledby="creatives-memory">
      <SectionHeader
        icon={Brain}
        id="creatives-memory"
        title="Memory"
        subtitle="What the agent remembers in every chat. Chats themselves are not kept, so decisions worth keeping belong here. Never a figure that isn’t public, or anything about a person."
      />

      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-2.5 rounded-row border border-hair bg-surface2/60 p-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">New note</span>
          <textarea
            className={`${TEXTAREA} min-h-[72px]`}
            value={text}
            maxLength={MEMORY_TEXT_MAX}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. TikTok hooks that ask a question do better than statements."
            disabled={adding}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="min-w-[150px] flex-1">
            <span className="sr-only">Category</span>
            <select
              className={SELECT}
              value={category}
              onChange={(e) => setCategory(e.target.value as CreativeMemoryCategory)}
              disabled={adding}
            >
              {MEMORY_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={BTN_PRIMARY} disabled={adding || text.trim() === ''}>
            <Plus size={15} aria-hidden="true" />
            {adding ? 'Adding…' : 'Add note'}
          </button>
        </div>
        {text.length > MEMORY_TEXT_MAX - 80 && (
          <span className="self-end font-mono text-[11px] tabular-nums text-faint">
            {text.length} / {MEMORY_TEXT_MAX}
          </span>
        )}
        {addError && (
          <p className={NOTICE.error} role="alert">
            <CircleAlert size={15} aria-hidden="true" />
            {addError}
          </p>
        )}
      </form>

      {deleteError && (
        <p className={NOTICE.error} role="alert">
          <CircleAlert size={15} aria-hidden="true" />
          {deleteError}
        </p>
      )}

      {!memories ? (
        <DataState loading={loading} error={error} onRetry={reload} label="memory" />
      ) : groups.length === 0 ? (
        <p className="rounded-row border border-dashed border-border px-4 py-8 text-center text-[13px] leading-[1.6] text-muted">
          Nothing remembered yet. Add a note above, or tell the agent “remember that …” in the chat.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <div key={g.key} className="flex flex-col gap-2">
              <h3 className="flex items-baseline gap-2 px-0.5">
                <span className="text-[12.5px] font-bold uppercase tracking-[0.06em] text-text">{g.label}</span>
                <span className="font-mono text-[11px] text-faint">{g.items.length}</span>
                <span className="min-w-0 truncate text-[11.5px] text-faint">· {g.hint}</span>
              </h3>
              <ul className="flex flex-col gap-2">
                {g.items.map((m) => (
                  <MemoryNote key={m.id} memory={m} onSave={update} onDelete={setDeleting} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={deleting !== null}
        title="Delete this note?"
        message={
          deleting
            ? `The agent will no longer remember: “${excerpt(deleting.text)}”. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete note"
        cancelLabel="Keep it"
        danger
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </section>
  )
}
