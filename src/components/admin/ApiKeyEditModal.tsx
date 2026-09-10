import { useEffect, useState, type FormEvent } from 'react'
import { KeyRound, Lock } from 'lucide-react'
import type { AdminApiKey, AdminApiKeyUpdateInput } from '../../types/admin'

/* ---- shared class strings (same vocabulary as AssetFormModal) ---- */
const FIELD = 'flex flex-col gap-1.5'
const FIELD_LABEL = 'text-[12px] font-semibold text-muted'
const FIELD_HINT = 'text-[11px] text-faint'
const CONTROL =
  'h-[42px] w-full border border-border rounded-field bg-surface2 px-3 text-[13.5px] text-text outline-none font-body focus:border-accent'
const BTN_BASE =
  'h-10 px-[18px] rounded-pill text-[13px] font-bold font-body disabled:opacity-60 disabled:cursor-not-allowed'

interface ApiKeyEditModalProps {
  /** null = closed. */
  apiKey: AdminApiKey | null
  saving: boolean
  error: string | null
  onSubmit: (input: AdminApiKeyUpdateInput) => void
  onCancel: () => void
}

/**
 * Edit one exchange account from the admin inventory.
 *
 * Only the display name and the enabled flag are editable. The key, the secret
 * and the live/demo flag are shown read-only on purpose — re-keying belongs to
 * the owner's own connect flow, and demo decides testnet-vs-real orders.
 */
export default function ApiKeyEditModal({
  apiKey,
  saving,
  error,
  onSubmit,
  onCancel,
}: ApiKeyEditModalProps) {
  const [name, setName] = useState('')
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    if (!apiKey) return
    setName(apiKey.name)
    setEnabled(apiKey.enabled)
  }, [apiKey])

  useEffect(() => {
    if (!apiKey) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [apiKey, onCancel])

  if (!apiKey) return null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit({ name: name.trim(), enabled })
  }

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center p-5 bg-black/55"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Edit API key"
    >
      <form
        className="w-full max-w-[480px] max-h-[90vh] overflow-y-auto bg-surface border border-border rounded-[18px] p-[26px] flex flex-col gap-3.5"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h3 className="font-display text-[20px] font-extrabold">Edit API Key</h3>
        <p className="text-[13px] text-muted -mt-2">
          {apiKey.owner.name || 'Unknown owner'}
          {apiKey.owner.email ? ` · ${apiKey.owner.email}` : ''}
        </p>

        {/* Read-only identity block — what this row actually is */}
        <div className="flex flex-col gap-2 rounded-[12px] border border-hair bg-surface2 p-3.5">
          <div className="flex items-center gap-2">
            <KeyRound size={14} className="flex-none text-muted" />
            <span className="font-mono text-[12.5px] text-text break-all">
              {apiKey.api_key_hint}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
            <span>
              Exchange:{' '}
              <strong className="text-text capitalize">{apiKey.exchange}</strong>
            </span>
            <span>
              Mode:{' '}
              <strong className="text-text">
                {apiKey.demo ? 'Demo (testnet)' : 'Live (real funds)'}
              </strong>
            </span>
          </div>
          <p className="flex items-start gap-1.5 text-[11px] text-faint">
            <Lock size={12} className="mt-px flex-none" />
            The key, the secret and the live/demo mode are not editable here —
            the owner re-connects to change them.
          </p>
        </div>

        <label className={FIELD}>
          <span className={FIELD_LABEL}>Display name *</span>
          <input
            type="text"
            className={CONTROL}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={128}
            required
          />
          <small className={FIELD_HINT}>
            A label only — used in logs and Telegram lines, never for routing.
          </small>
        </label>

        <label className="flex items-center gap-3 border border-border rounded-[12px] py-3 px-3.5 cursor-pointer">
          <input
            type="checkbox"
            className="w-[18px] h-[18px] accent-[var(--accent)] cursor-pointer"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <div>
            <span className="text-[13.5px] font-semibold block">Enabled</span>
            <small className="text-[11.5px] text-faint">
              Off means the engine skips this account entirely — no new entries,
              no exits.
            </small>
          </div>
        </label>

        {error && (
          <p
            className="py-2.5 px-3.5 border border-[rgba(239,68,68,0.35)] rounded-field bg-[rgba(239,68,68,0.08)] text-[#ef4444] text-[13px]"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2.5 mt-1">
          <button
            type="button"
            className={`${BTN_BASE} border border-border bg-surface2 text-text`}
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`${BTN_BASE} border-0 bg-accent text-on-accent`}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
