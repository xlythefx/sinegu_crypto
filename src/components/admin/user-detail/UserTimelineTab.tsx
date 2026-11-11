import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { History, StickyNote, Trash2 } from 'lucide-react'
import ConfirmModal from '../../ui/ConfirmModal'
import { useApiData } from '../../../hooks/useApiData'
import { addAdminUserNote, deleteAdminUserNote, getAdminUserTimeline } from '../../../services/admin'
import { getApiErrorMessage } from '../../../services/api'
import { fmtDateTime } from '../../../lib/format'
import type { TimelineEvent } from '../../../types/admin'

const DOT: Record<TimelineEvent['tone'], string> = {
  good: 'bg-green',
  bad: 'bg-red',
  info: 'bg-accent',
  neutral: 'bg-faint',
  note: 'bg-[#8b7cf6]',
}

const KIND_LABEL: Record<TimelineEvent['kind'], string> = {
  signup: 'Sign-up',
  admin: 'Admin',
  account: 'Exchange',
  key: 'API key',
  trade: 'Trading',
  invoice: 'Billing',
  payment: 'Payment',
  note: 'Note',
}

/**
 * Everything that happened to this customer, newest first, with notes (the
 * admin audit, 2026-11-11): signed up, approved, connected a key, first
 * trade, each invoice issued / overdue / paid (how, and by whom), key refused,
 * every admin action. Admin actions are recorded from 2026-11-11; invoices,
 * keys and trades go back to the start. Full admins only.
 */
export default function UserTimelineTab({ uniId, name }: { uniId: string; name: string }) {
  const fetchEvents = useCallback(() => getAdminUserTimeline(uniId), [uniId])
  const { data: events, loading, error, reload } = useApiData(fetchEvents, [fetchEvents])

  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<TimelineEvent | null>(null)

  const save = async () => {
    const body = draft.trim()
    if (!body) return
    setSaving(true)
    setSaveError(null)
    try {
      await addAdminUserNote(uniId, body)
      setDraft('')
      reload()
    } catch (err) {
      setSaveError(getApiErrorMessage(err, 'Could not save the note.'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!deleting?.note_id) return
    try {
      await deleteAdminUserNote(uniId, deleting.note_id)
      reload()
    } catch (err) {
      setSaveError(getApiErrorMessage(err, 'Could not delete the note.'))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="flex flex-col gap-stack">
      <section className="rounded-card border border-border bg-surface p-card">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="grid h-7 w-7 flex-none place-items-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
            <StickyNote size={15} />
          </span>
          <div>
            <div className="font-display text-[15px] font-extrabold">Add a note</div>
            <div className="mt-px text-[12px] text-muted">Seen by every admin, on this timeline. Saved with your name.</div>
          </div>
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
          rows={3}
          placeholder={`e.g. "${name || 'Customer'} paid October by bank, ref 4471" or "Promised to top up on Friday"`}
          className="w-full rounded-field border border-border bg-surface2 px-3 py-2.5 text-[13px] text-text placeholder:text-faint focus:border-accent focus:outline-none resize-y"
        />
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12px] text-red">{saveError}</span>
          <button
            type="button"
            onClick={save}
            disabled={saving || !draft.trim()}
            className="rounded-pill bg-accent px-[18px] py-2 text-[13px] font-bold text-on-accent cursor-pointer enabled:hover:brightness-[1.06] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save note'}
          </button>
        </div>
      </section>

      <section className="rounded-card border border-border bg-surface p-card">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="grid h-7 w-7 flex-none place-items-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
            <History size={15} />
          </span>
          <div>
            <div className="font-display text-[15px] font-extrabold">Timeline</div>
            <div className="mt-px text-[12px] text-muted">
              Newest first. Admin actions are recorded from Nov 11, 2026; invoices, keys and trades go back to the start.
            </div>
          </div>
        </div>

        {!events ? (
          <p className="py-8 text-center text-[13px] text-muted">
            {loading ? 'Loading the timeline…' : error ? 'Could not load the timeline.' : ''}
          </p>
        ) : events.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-muted">Nothing recorded yet.</p>
        ) : (
          <ol className="relative ml-1.5 border-l border-hair">
            {events.map((e, i) => (
              <li key={`${e.at}-${i}`} className="relative pb-4 pl-5 last:pb-0">
                <span className={`absolute -left-[5px] top-[6px] h-[9px] w-[9px] rounded-full ring-4 ring-surface ${DOT[e.tone]}`} />
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                  <span className="font-mono text-[11px] text-faint">{fmtDateTime(e.at)}</span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-faint">{KIND_LABEL[e.kind]}</span>
                  {e.by && <span className="text-[11.5px] text-muted">by {e.by}</span>}
                </div>
                {e.kind === 'note' ? (
                  <div className="mt-1 flex items-start gap-2 rounded-[10px] border border-border bg-surface2 px-3 py-2.5">
                    <p className="min-w-0 flex-1 whitespace-pre-wrap text-[13px] text-text">{e.detail}</p>
                    <button
                      type="button"
                      onClick={() => setDeleting(e)}
                      className="flex-none rounded-btn p-1 text-faint cursor-pointer hover:text-red"
                      aria-label="Delete note"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="mt-0.5 text-[13px] font-semibold text-text">
                      {e.invoice_id ? (
                        <Link
                          to={`/admin/invoices/${e.invoice_id}`}
                          state={{ backLabel: `Back to ${name || 'the profile'}` }}
                          className="hover:text-accent"
                        >
                          {e.title}
                        </Link>
                      ) : (
                        e.title
                      )}
                    </p>
                    {e.detail && <p className="text-[12px] text-muted">{e.detail}</p>}
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <ConfirmModal
        open={deleting !== null}
        title="Delete this note?"
        message="It is removed for every admin. The deletion itself is recorded on the timeline."
        confirmLabel="Yes, delete"
        cancelLabel="No"
        danger
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
