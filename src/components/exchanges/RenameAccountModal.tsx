import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Pencil } from 'lucide-react'
import type { ExchangeAccount } from '../../types/exchanges'
import { renameExchangeAccount } from '../../services/exchanges'
import { getApiErrorMessage } from '../../services/api'

interface RenameAccountModalProps {
  /** The account being renamed — null keeps the modal closed. */
  account: ExchangeAccount | null
  onClose: () => void
  /** Called after a successful rename so the page can reload its list. */
  onRenamed: (account: ExchangeAccount) => void
}

const FIELD_LABEL =
  'font-mono text-[10px] font-semibold tracking-[0.12em] text-faint'

const INPUT =
  'h-[42px] rounded-nav border border-border bg-surface2 px-3.5 text-[13px] text-text outline-none transition-colors duration-150 placeholder:text-faint focus:border-accent-line'

const GHOST_BTN =
  'rounded-pill border border-border bg-surface2 px-5 py-2.5 text-[13.5px] font-semibold text-text disabled:cursor-not-allowed disabled:opacity-60'

/**
 * Small single-field modal for renaming a connected exchange account. The name
 * is a display label only — API keys and trading are untouched.
 *
 * Portalled into <body> for the same reason ConfirmModal is: the trigger sits
 * inside an AOS-animated ancestor, whose `transform` would otherwise become the
 * containing block for this fixed overlay.
 */
export default function RenameAccountModal({
  account,
  onClose,
  onRenamed,
}: RenameAccountModalProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Seed the field from the account every time the modal opens.
  useEffect(() => {
    if (account) {
      setName(account.name)
      setError(null)
      setSaving(false)
    }
  }, [account])

  useEffect(() => {
    if (!account) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [account, onClose])

  if (!account) return null

  const trimmed = name.trim()
  const unchanged = trimmed === account.name

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!trimmed) return
    if (unchanged) {
      onClose()
      return
    }
    setError(null)
    setSaving(true)
    try {
      const updated = await renameExchangeAccount(account, trimmed)
      onRenamed(updated)
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to rename the account.'))
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex animate-[fadeup_0.2s_ease_both] items-center justify-center overflow-y-auto bg-black/55 p-6 backdrop-blur-[3px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Rename account"
    >
      <div
        className="my-auto w-full max-w-[440px] animate-[fadeup_0.25s_cubic-bezier(0.2,0.7,0.2,1)_both] rounded-[20px] border border-border bg-surface p-7 shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-row border border-accent-line bg-accent-soft text-accent">
          <Pencil size={17} />
        </span>
        <h3 className="font-display text-[20px] font-extrabold tracking-[-0.02em] text-text">
          Rename account
        </h3>
        <p className="mt-1 text-[13px] leading-[1.6] text-muted">
          This is just the label you see across the dashboard — your API keys
          and running bots stay exactly as they are.
        </p>

        <form className="mt-[18px] flex flex-col gap-3.5" onSubmit={onSubmit}>
          <label className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL}>ACCOUNT NAME</span>
            <input
              type="text"
              className={INPUT}
              placeholder="e.g. Main Trading"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={128}
              autoFocus
            />
          </label>

          {error && (
            <p
              className="rounded-field border border-[rgba(255,90,90,0.3)] bg-[rgba(255,90,90,0.08)] px-3 py-[9px] text-[12.5px] text-red"
              role="alert"
            >
              {error}
            </p>
          )}

          <div className="mt-2 flex flex-wrap justify-end gap-2.5">
            <button
              type="button"
              className={GHOST_BTN}
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-pill border-none bg-accent px-5 py-2.5 text-[13.5px] font-bold text-on-accent shadow-[0_10px_24px_var(--glow)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving || !trimmed}
            >
              {saving ? 'Saving…' : 'Save name'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
