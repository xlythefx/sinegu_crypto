import { useState } from 'react'
import { Check, ChevronDown, ExternalLink, MessageSquareText, RotateCcw } from 'lucide-react'
import { Pill } from '../../ui/Pill'
import { formatDate } from '../../../lib/format'
import type { AdminTodo, AdminTodoState } from '../../../types/adminTodos'

interface TodoItemCardProps {
  item: AdminTodo
  state: AdminTodoState | undefined
  busy: boolean
  onToggleDone: (done: boolean) => void
  onSaveNote: (note: string) => Promise<void>
}

const BTN =
  'inline-flex items-center justify-center gap-1.5 rounded-[9px] border py-[7px] px-3 text-[12px] font-semibold cursor-pointer transition-[border-color,color,background] duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_PRIMARY = `${BTN} border-accent bg-accent text-on-accent enabled:hover:brightness-110`
const BTN_GHOST = `${BTN} border-border bg-surface2 text-muted enabled:hover:text-text enabled:hover:border-accent`

/**
 * One item: what, why, the steps, the env keys, the links — and the owner's
 * two controls, Mark done / Reopen and the note. A `decision` item's note is
 * where the decision itself gets written down, so it is always open for one.
 */
export default function TodoItemCard({ item, state, busy, onToggleDone, onSaveNote }: TodoItemCardProps) {
  const done = Boolean(state?.done_at)
  const [open, setOpen] = useState(!done)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(state?.note ?? '')
  const [saving, setSaving] = useState(false)

  const startEdit = () => {
    setDraft(state?.note ?? '')
    setEditing(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      await onSaveNote(draft)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <article
      className={`rounded-card border bg-surface transition-[border-color,opacity] duration-200 ${
        done ? 'border-hair opacity-80' : item.kind === 'decision' ? 'border-accent-line' : 'border-border'
      }`}
    >
      <button
        type="button"
        className="flex w-full items-start gap-3 p-[16px] text-left cursor-pointer max-[520px]:p-3.5"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span
          className={`mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-[7px] border ${
            done ? 'border-green bg-[color-mix(in_srgb,var(--green)_18%,transparent)] text-green' : 'border-border bg-surface2 text-faint'
          }`}
          aria-hidden="true"
        >
          {done ? <Check size={14} strokeWidth={3} /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Pill tone={item.kind === 'decision' ? 'accent' : 'muted'} size="xs">
              {item.kind}
            </Pill>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.07em] text-faint">{item.feature}</span>
            <span className="font-mono text-[10.5px] text-faint">· added {formatDate(item.added)}</span>
          </span>
          <span
            className={`mt-1 block font-display text-[15px] font-extrabold leading-[1.3] ${
              done ? 'text-muted line-through decoration-hair' : 'text-text'
            }`}
          >
            {item.title}
          </span>
          {done && state && (
            <span className="mt-1 block text-[12px] text-faint">
              Done {formatDate(state.done_at)}
              {state.done_by_name ? ` by ${state.done_by_name}` : ''}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`mt-1 flex-none text-faint transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="border-t border-hair px-[16px] pb-[16px] pt-3.5 animate-[fadeup_0.25s_ease-out] max-[520px]:px-3.5">
          <p className="text-[13px] leading-[1.55] text-muted">{item.why}</p>

          <ol className="mt-3.5 flex list-none flex-col gap-2 p-0">
            {item.steps.map((step, i) => (
              <li key={i} className="flex gap-2.5 text-[13px] leading-[1.55] text-text">
                <span className="mt-[3px] grid h-5 w-5 flex-none place-items-center rounded-full bg-surface2 font-mono text-[10.5px] font-bold text-faint">
                  {i + 1}
                </span>
                <span className="[overflow-wrap:anywhere]">{step}</span>
              </li>
            ))}
          </ol>

          {(item.envKeys?.length || item.links?.length) ? (
            <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
              {item.envKeys?.map((key) => (
                <code
                  key={key}
                  className="rounded-[7px] border border-border bg-surface2 px-2 py-0.5 font-mono text-[11.5px] text-text [overflow-wrap:anywhere]"
                >
                  {key}
                </code>
              ))}
              {item.links?.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-[7px] border border-accent-line bg-accent-soft px-2 py-0.5 text-[11.5px] font-semibold text-accent hover:underline"
                >
                  {link.label}
                  <ExternalLink size={11} />
                </a>
              ))}
            </div>
          ) : null}

          <div className="mt-4 rounded-[10px] border border-hair bg-surface2 p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-faint">
              <MessageSquareText size={12} />
              {item.kind === 'decision' ? 'Decision' : 'Note'}
            </div>
            {editing ? (
              <>
                <textarea
                  className="min-h-[88px] w-full resize-y rounded-[9px] border border-border bg-surface px-3 py-2 font-body text-[13px] leading-[1.5] text-text outline-none focus:border-accent"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={4000}
                  placeholder={
                    item.kind === 'decision'
                      ? 'What did you decide, and why?'
                      : 'Anything worth remembering about this — where you got stuck, what you chose.'
                  }
                  autoFocus
                />
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  <button type="button" className={BTN_GHOST} onClick={() => setEditing(false)} disabled={saving}>
                    Cancel
                  </button>
                  <button type="button" className={BTN_PRIMARY} onClick={() => void save()} disabled={saving}>
                    {saving ? 'Saving…' : 'Save note'}
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="block w-full text-left text-[13px] leading-[1.5] cursor-text"
                onClick={startEdit}
                title="Click to edit"
              >
                {state?.note ? (
                  <span className="whitespace-pre-wrap text-text [overflow-wrap:anywhere]">{state.note}</span>
                ) : (
                  <span className="text-faint">
                    {item.kind === 'decision' ? 'Not decided yet — click to write it down.' : 'No note — click to add one.'}
                  </span>
                )}
              </button>
            )}
          </div>

          <div className="mt-3.5 flex flex-wrap justify-end gap-2">
            {done ? (
              <button type="button" className={BTN_GHOST} onClick={() => onToggleDone(false)} disabled={busy}>
                <RotateCcw size={13} />
                Reopen
              </button>
            ) : (
              <button type="button" className={BTN_PRIMARY} onClick={() => onToggleDone(true)} disabled={busy}>
                <Check size={13} strokeWidth={3} />
                {item.kind === 'decision' ? 'Mark decided' : 'Mark done'}
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  )
}
