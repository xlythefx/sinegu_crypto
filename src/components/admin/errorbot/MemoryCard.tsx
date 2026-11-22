import { useState } from 'react'
import { Brain, Download, Pencil, Plus, Trash2 } from 'lucide-react'
import ConfirmModal from '../../ui/ConfirmModal'
import { Pill } from '../../ui/Pill'
import { fmtDateTime } from '../../../lib/format'
import { memoriesToMarkdown } from '../../../lib/devBotMemory'
import type { DevBotMemory } from '../../../types/adminDevBot'

const CARD = 'flex min-w-0 flex-col gap-4 rounded-card border border-border bg-surface p-card max-[480px]:p-3.5'
const BTN =
  'inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[9px] border border-border bg-surface2 px-3 text-[12.5px] font-semibold text-text transition-[border-color] duration-150 disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:border-accent'
const FIELD =
  'w-full rounded-[9px] border border-border bg-surface2 px-3 py-2 text-[13px] text-text outline-none focus:border-accent'

interface Draft {
  id?: number
  title: string
  body: string
}

interface MemoryCardProps {
  memories: DevBotMemory[]
  onSave: (memory: Draft) => Promise<void>
  onDelete: (id: number) => Promise<void>
}

/**
 * What the PC agent learned on earlier jobs — a cause, how to recognise it,
 * what fixes it. It reads all of this before every job. Admins can add,
 * correct or delete a note, and download the whole memory as Markdown.
 */
export default function MemoryCard({ memories, onSave, onDelete }: MemoryCardProps) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<DevBotMemory | null>(null)

  const save = async () => {
    if (!draft || !draft.title.trim() || !draft.body.trim()) return
    setBusy(true)
    try {
      await onSave({ ...draft, title: draft.title.trim(), body: draft.body.trim() })
      setDraft(null)
    } finally {
      setBusy(false)
    }
  }

  const download = () => {
    const blob = new Blob([memoriesToMarkdown(memories)], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pixel-alpha-agent-memory-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className={CARD} data-aos="fade-up" data-aos-delay={140} aria-labelledby="errorbot-memory">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 basis-[260px]">
          <h2 id="errorbot-memory" className="inline-flex items-center gap-2 font-display text-[16px] font-extrabold text-text">
            <Brain size={17} className="text-accent" aria-hidden="true" /> Memory
          </h2>
          <p className="mt-1 text-[12.5px] leading-[1.5] text-muted">
            What the PC agent learned: a cause, how to recognise it, what fixes it. It reads all of this before every job,
            so a problem it has seen before is answered faster. Correct anything that is wrong.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BTN} disabled={memories.length === 0} onClick={download}>
            <Download size={14} aria-hidden="true" /> Download .md
          </button>
          <button type="button" className={BTN} disabled={draft !== null} onClick={() => setDraft({ title: '', body: '' })}>
            <Plus size={14} aria-hidden="true" /> Add a note
          </button>
        </div>
      </header>

      {draft && (
        <div className="flex flex-col gap-2.5 rounded-[10px] border border-accent-line bg-surface2 p-3.5">
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            Title
            <input className={FIELD} value={draft.title} maxLength={200} placeholder="e.g. SANTOS allows at most 10× on Binance"
              onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted">
            What to know
            <textarea className={`${FIELD} min-h-[110px] resize-y leading-[1.5]`} value={draft.body} maxLength={6000}
              placeholder="The cause, how to recognise it, and what fixes it."
              onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={BTN} disabled={busy} onClick={() => setDraft(null)}>Cancel</button>
            <button type="button" className={`${BTN} border-accent text-accent`} disabled={busy || !draft.title.trim() || !draft.body.trim()}
              onClick={() => void save()}>
              {draft.id ? 'Save changes' : 'Add note'}
            </button>
          </div>
        </div>
      )}

      {memories.length === 0 && !draft ? (
        <p className="rounded-[10px] border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted">
          Nothing learned yet. After each investigation the agent writes down what is worth knowing next time.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {memories.map((m) => (
            <li key={m.id} className="flex flex-col gap-1.5 rounded-[10px] border border-border px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 break-words text-[13.5px] font-bold text-text">{m.title}</span>
                <Pill tone={m.source === 'agent' ? 'accent' : 'muted'}>{m.source === 'agent' ? 'Learned' : 'Written'}</Pill>
                <span className="ml-auto flex gap-1.5">
                  <button type="button" aria-label={`Edit “${m.title}”`} className={`${BTN} px-2.5`} disabled={draft !== null}
                    onClick={() => setDraft({ id: m.id, title: m.title, body: m.body })}>
                    <Pencil size={13} aria-hidden="true" />
                  </button>
                  <button type="button" aria-label={`Delete “${m.title}”`} className={`${BTN} px-2.5`} disabled={busy}
                    onClick={() => setConfirmDelete(m)}>
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words text-[12.5px] leading-[1.55] text-muted">{m.body}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-muted">
                {m.job_id && <span>from job #{m.job_id}</span>}
                {m.updated_by && <span>by {m.updated_by}</span>}
                {m.updated_at && <span>{fmtDateTime(m.updated_at)}</span>}
                {m.signature && <span className="break-all font-mono">{m.signature}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        open={confirmDelete !== null}
        title="Delete this note?"
        message={`“${confirmDelete?.title ?? ''}” — the agent will no longer be told it.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          const m = confirmDelete
          setConfirmDelete(null)
          if (m) void onDelete(m.id)
        }}
      />
    </section>
  )
}
