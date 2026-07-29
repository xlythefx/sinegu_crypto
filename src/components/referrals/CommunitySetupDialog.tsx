import { useEffect, useState, type FormEvent } from 'react'
import { AlertCircle, Save, Users, X } from 'lucide-react'
import { saveCommunity } from '../../services/referrals'
import { getApiErrorMessage } from '../../services/api'
import type { CommunityDetails } from '../../types/referrals'

interface CommunitySetupDialogProps {
  open: boolean
  /** Existing profile to prefill when editing, null on first setup. */
  community: CommunityDetails | null
  onClose: () => void
  /** Called after a successful save — close + reload. */
  onSaved: () => void
}

const LABEL =
  'flex items-center gap-1.5 text-[11px] font-bold tracking-[0.05em] uppercase text-faint'
const INPUT =
  'w-full px-3 border border-border rounded-field bg-surface2 text-text font-body text-[13px] outline-none transition-[border-color,background] duration-150 focus:border-accent-line focus:bg-surface disabled:opacity-60'

/** Name + bio community profile dialog — both fields required to save. */
export default function CommunitySetupDialog({
  open,
  community,
  onClose,
  onSaved,
}: CommunitySetupDialogProps) {
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(community?.communityName ?? '')
    setBio(community?.bio ?? '')
    setError(null)
  }, [open, community])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const canSave = name.trim() !== '' && bio.trim() !== '' && !busy

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    setBusy(true)
    setError(null)
    try {
      await saveCommunity(name.trim(), bio.trim())
      onSaved()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save your community profile.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center p-5 bg-[var(--bgScrim)] backdrop-blur-[4px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Set up your community profile"
    >
      <div
        className="relative w-full max-w-[460px] bg-surface border border-border rounded-[18px] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute top-4 right-4 w-8 h-8 grid place-items-center rounded-btn bg-transparent text-faint cursor-pointer hover:bg-surface2 hover:text-text"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="flex gap-3 items-center mb-[18px] pr-10">
          <span className="w-[38px] h-[38px] flex-shrink-0 grid place-items-center rounded-[11px] bg-[var(--bubble)] border border-accent-line text-accent">
            <Users size={16} />
          </span>
          <div>
            <h3 className="text-[17px] font-bold">
              Set up your community profile
            </h3>
            <p className="text-[12.5px] text-muted mt-0.5">
              Shown to the traders you invite.
            </p>
          </div>
        </div>

        <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
          {error && (
            <div
              className="flex items-start gap-2 py-2.5 px-3 border border-[rgba(255,90,90,0.35)] bg-[rgba(255,90,90,0.08)] rounded-field text-[12.5px] font-semibold text-red [&>svg]:flex-none [&>svg]:mt-px"
              role="alert"
            >
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className={LABEL} htmlFor="community-name">
              Community name *
            </label>
            <input
              id="community-name"
              className={`${INPUT} h-10`}
              type="text"
              placeholder="e.g. Alpha Signals Crew"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              disabled={busy}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={LABEL} htmlFor="community-bio">
              Short bio *
            </label>
            <textarea
              id="community-bio"
              className={`${INPUT} py-2.5 resize-none leading-[1.5]`}
              rows={4}
              placeholder="Tell invited traders what your community is about…"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={300}
              disabled={busy}
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-hair">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-1.5 h-[38px] px-4 rounded-field border border-border bg-surface text-text text-[12.5px] font-bold cursor-pointer transition-[border-color,background] duration-150 hover:border-accent-line hover:bg-accent-soft"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 h-[38px] px-4 rounded-field border border-transparent bg-accent text-on-accent text-[12.5px] font-bold cursor-pointer shadow-[0_8px_20px_var(--glow)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              disabled={!canSave}
            >
              <Save size={13} />
              {busy ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
