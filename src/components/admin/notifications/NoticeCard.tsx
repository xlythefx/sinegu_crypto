import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Lock, Plus, RotateCcw, X } from 'lucide-react'
import ConfirmModal from '../../ui/ConfirmModal'
import { updateAdminNotification } from '../../../services/admin'
import { getApiErrorMessage } from '../../../services/api'
import { fmtDateTime } from '../../../lib/format'
import type { TeamNotice } from '../../../types/activity'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * One team email: on/off, the addresses it goes to, add / remove one, back to
 * the server's default list. Every change saves at once; switching a notice
 * OFF is confirmed first. Critical alerts are always on and keep ≥ 1 address
 * (the API refuses otherwise — this only mirrors it).
 */
export default function NoticeCard({ notice, onSaved }: { notice: TeamNotice; onSaved: (n: TeamNotice) => void }) {
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [askOff, setAskOff] = useState(false)
  const [askReset, setAskReset] = useState(false)

  const save = async (enabled: boolean, recipients: string[] | null) => {
    setSaving(true)
    setError(null)
    try {
      onSaved(await updateAdminNotification(notice.slug, { enabled, recipients }))
      return true
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save.'))
      return false
    } finally {
      setSaving(false)
    }
  }

  const add = async (e: FormEvent) => {
    e.preventDefault()
    const email = draft.trim().toLowerCase()
    if (!email) return
    if (!EMAIL.test(email)) {
      setError('That is not an email address.')
      return
    }
    if (notice.recipients.includes(email)) {
      setError('Already on the list.')
      return
    }
    if (await save(notice.enabled, [...notice.recipients, email])) setDraft('')
  }

  const remove = (email: string) => {
    const next = notice.recipients.filter((a) => a !== email)
    if (notice.critical && next.length === 0) {
      setError('This alert needs at least one address. Add another before removing this one.')
      return
    }
    void save(notice.enabled, next)
  }

  const toggle = () => {
    if (notice.critical) return
    if (notice.enabled) setAskOff(true)
    else void save(true, notice.uses_default ? null : notice.recipients)
  }

  const on = notice.enabled
  const nobody = on && notice.recipients.length === 0

  return (
    <article
      className={`rounded-card border bg-surface p-card transition-opacity duration-200 ${
        on ? 'border-border' : 'border-hair opacity-75'
      }`}
    >
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="m-0 font-display text-[15px] font-extrabold">{notice.title}</h3>
            {notice.critical && (
              <span className="inline-flex items-center gap-1 rounded-pill border border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)] px-2 py-px text-[10.5px] font-bold text-red">
                <Lock size={10} aria-hidden="true" /> Always on
              </span>
            )}
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{notice.when}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={`${notice.title}: ${on ? 'on' : 'off'}`}
          disabled={saving || notice.critical}
          onClick={toggle}
          title={notice.critical ? 'A failed close or a serious fault must always reach somebody.' : undefined}
          className="inline-flex flex-none items-center gap-2 rounded-pill py-1 pl-2 cursor-pointer disabled:cursor-not-allowed"
        >
          <span className={`text-[12.5px] font-semibold ${on ? 'text-accent' : 'text-muted'}`}>{on ? 'On' : 'Off'}</span>
          <span
            className={`relative inline-block h-[22px] w-10 rounded-pill border transition-[background,border-color] duration-150 ${
              on ? 'border-accent bg-accent' : 'border-border bg-surface2'
            } ${notice.critical ? 'opacity-60' : ''}`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-pill transition-[transform,background] duration-150 ${
                on ? 'translate-x-[18px] bg-on-accent' : 'bg-muted'
              }`}
            />
          </span>
        </button>
      </header>

      <div className="mt-4">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold uppercase tracking-[0.06em] text-faint">
          <span>Sent to</span>
          {notice.uses_default && (
            <span className="normal-case tracking-normal font-medium text-faint">the server’s default list</span>
          )}
        </div>
        {notice.recipients.length === 0 ? (
          <p className={`text-[12.5px] ${nobody ? 'text-red' : 'text-muted'}`}>
            {nobody ? 'Nobody — add an address, or this email is not sent.' : 'Nobody.'}
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {notice.recipients.map((a) => (
              <li
                key={a}
                className="inline-flex max-w-full items-center gap-1 rounded-pill border border-border bg-surface2 py-1 pl-3 pr-1 text-[12.5px] text-text animate-[fadeup_0.25s_ease-out]"
              >
                <span className="truncate">{a}</span>
                <button
                  type="button"
                  onClick={() => remove(a)}
                  disabled={saving}
                  aria-label={`Remove ${a}`}
                  className="grid h-6 w-6 flex-none place-items-center rounded-pill text-faint cursor-pointer hover:bg-surface hover:text-red disabled:cursor-not-allowed"
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={add} className="mt-3 flex flex-wrap gap-2">
          <input
            type="email"
            inputMode="email"
            autoComplete="off"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setError(null)
            }}
            placeholder="name@example.com"
            aria-label={`Add an email to “${notice.title}”`}
            className="min-h-9 min-w-0 flex-1 basis-[220px] rounded-field border border-border bg-surface2 px-3 text-[13px] text-text placeholder:text-faint focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={saving || !draft.trim()}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-pill bg-accent px-4 text-[12.5px] font-bold text-on-accent cursor-pointer enabled:hover:brightness-[1.06] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={14} /> Add
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-2 text-[12px] text-red">
            {error}
          </p>
        )}
      </div>

      <footer className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hair pt-3 text-[12px]">
        <Link to={`/admin/sandbox/emails/${notice.slug}`} className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
          <Eye size={13} /> See the email
        </Link>
        {!notice.uses_default && (
          <button
            type="button"
            onClick={() => setAskReset(true)}
            disabled={saving}
            className="inline-flex items-center gap-1 font-semibold text-muted cursor-pointer hover:text-text disabled:cursor-not-allowed"
          >
            <RotateCcw size={12} /> Back to the default list
          </button>
        )}
        {notice.updated_at && (
          <span className="ml-auto text-faint">
            Changed {fmtDateTime(notice.updated_at)}
            {notice.updated_by ? ` by ${notice.updated_by}` : ''}
          </span>
        )}
      </footer>

      <ConfirmModal
        open={askOff}
        title={`Stop sending “${notice.title}”?`}
        message="Nobody will get this email until it is switched back on. Everything it reports still happens and is still shown in the admin pages."
        confirmLabel="Yes, switch off"
        cancelLabel="No"
        danger
        onConfirm={() => {
          setAskOff(false)
          void save(false, notice.uses_default ? null : notice.recipients)
        }}
        onCancel={() => setAskOff(false)}
      />
      <ConfirmModal
        open={askReset}
        title="Use the default list again?"
        message={`This email goes back to the server’s list: ${notice.default_recipients.join(', ') || 'nobody'}.`}
        confirmLabel="Yes, reset"
        cancelLabel="No"
        onConfirm={() => {
          setAskReset(false)
          void save(notice.enabled, null)
        }}
        onCancel={() => setAskReset(false)}
      />
    </article>
  )
}
