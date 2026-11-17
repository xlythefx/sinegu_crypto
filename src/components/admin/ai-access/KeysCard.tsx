import { useState, type FormEvent } from 'react'
import { AlertCircle, KeyRound } from 'lucide-react'
import ConfirmModal from '../../ui/ConfirmModal'
import KeyRow from './KeyRow'
import NewKeyReveal from './NewKeyReveal'
import { BTN_PRIMARY, FIELD, HINT, INPUT, LABEL, SELECT, notice } from '../../settings/formClasses'
import { createAiKey, revokeAiKey, setAiKeyCanCreate } from '../../../services/aiAccess'
import { getApiErrorMessage } from '../../../services/api'
import type { AiAccessData, AiAccessKey } from '../../../types/aiAccess'

/** The select's value for a key with no expiry date. */
const NEVER = 'never'

interface KeysCardProps {
  data: AiAccessData
  /** Re-read the page after a key is made or revoked. */
  onChanged: () => void
  delay?: number
}

/**
 * Make a key (confirmed — it opens every trade, account and invoice to
 * whoever holds it), see it once, and revoke any key in one step (confirmed).
 */
export default function KeysCard({ data, onChanged, delay }: KeysCardProps) {
  const [name, setName] = useState('Grok')
  /** null = never expires. */
  const [days, setDays] = useState<number | null>(data.default_expiry_days)
  const [confirmCreate, setConfirmCreate] = useState(false)
  const [revoking, setRevoking] = useState<AiAccessKey | null>(null)
  /** A key's "May create in Creatives" switch, waiting for its confirmation. */
  const [creating, setCreating] = useState<{ key: AiAccessKey; on: boolean } | null>(null)
  const limits = data.create
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ name: string; plain: string } | null>(null)

  const active = data.keys.filter((k) => k.state === 'active').length
  const atLimit = active >= data.max_active_keys

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 2) {
      setError('Give the key a name of at least 2 characters, e.g. “Boss’s Grok”.')
      return
    }
    setError(null)
    setConfirmCreate(true)
  }

  const create = async () => {
    setConfirmCreate(false)
    setBusy(true)
    setError(null)
    try {
      const made = await createAiKey(name.trim(), days)
      setCreated({ name: made.key.name, plain: made.plain_key })
      onChanged()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create the key.'))
    } finally {
      setBusy(false)
    }
  }

  const toggleCreate = async () => {
    if (!creating) return
    const { key: target, on } = creating
    setCreating(null)
    setBusy(true)
    setError(null)
    try {
      await setAiKeyCanCreate(target.id, on)
      onChanged()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not change what this key may do.'))
    } finally {
      setBusy(false)
    }
  }

  const revoke = async () => {
    if (!revoking) return
    const target = revoking
    setRevoking(null)
    setBusy(true)
    setError(null)
    try {
      await revokeAiKey(target.id)
      onChanged()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not revoke the key.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className="flex min-w-0 flex-col gap-4 rounded-card border border-border bg-surface p-card max-[480px]:p-3.5"
      data-aos="fade-up"
      data-aos-delay={delay}
      aria-labelledby="ai-keys"
    >
      <header className="flex items-start gap-3">
        <span
          className="grid h-9 w-9 flex-none place-items-center rounded-[10px] border border-accent-line bg-accent-soft text-accent"
          aria-hidden="true"
        >
          <KeyRound size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="ai-keys" className="font-display text-[16px] font-extrabold text-text">
            Keys
          </h2>
          <p className="mt-0.5 text-[12.5px] leading-[1.55] text-muted">
            One key per person or device. It expires after the time you pick (or never), can be revoked at any moment,
            and only opens read-only questions — unless you switch on “May create in Creatives” for it. {active} of{' '}
            {data.max_active_keys} active.
          </p>
        </div>
      </header>

      {error && (
        <p className={notice('error')} role="alert">
          <AlertCircle size={15} aria-hidden="true" />
          {error}
        </p>
      )}

      {created && <NewKeyReveal name={created.name} plainKey={created.plain} onDone={() => setCreated(null)} />}

      <form onSubmit={submit} className="grid min-w-0 grid-cols-1 gap-3.5 sm:grid-cols-[minmax(0,1fr)_210px_auto] sm:items-end">
        <label className={FIELD}>
          <span className={LABEL}>Name</span>
          <input
            className={INPUT}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Boss’s Grok"
            disabled={busy || atLimit}
          />
        </label>
        <label className={FIELD}>
          <span className={LABEL}>Expires after</span>
          <select
            className={SELECT}
            value={days ?? NEVER}
            onChange={(e) => setDays(e.target.value === NEVER ? null : Number(e.target.value))}
            disabled={busy || atLimit}
          >
            {data.expiry_days.map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
            <option value={NEVER}>Never (until revoked)</option>
          </select>
        </label>
        <button type="submit" className={BTN_PRIMARY} disabled={busy || atLimit}>
          Create key
        </button>
        {atLimit && <p className={`${HINT} sm:col-span-3`}>Revoke a key before making another.</p>}
      </form>

      {data.keys.length === 0 ? (
        <p className="rounded-row border border-dashed border-border py-5 text-center text-[13px] text-muted">
          No keys yet. Create one, then paste it into Grok.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {data.keys.map((k) => (
            <KeyRow
              key={k.id}
              aiKey={k}
              onRevoke={setRevoking}
              onCreate={(key, on) => setCreating({ key, on })}
              spent={limits.spent.find((s) => s.key_id === k.id) ?? null}
              busy={busy}
            />
          ))}
        </ul>
      )}

      <ConfirmModal
        open={confirmCreate}
        title={`Create the key “${name.trim()}”?`}
        message={
          days === null
            ? 'Whoever holds it can read every signal, trade, account and invoice — customer names included — through their AI assistant. This key NEVER expires: it keeps working until you revoke it on this page. It cannot change anything.'
            : `Whoever holds it can read every signal, trade, account and invoice — customer names included — through their AI assistant for ${days} days, until you revoke it. It cannot change anything.`
        }
        confirmLabel="Create key"
        cancelLabel="Cancel"
        onConfirm={create}
        onCancel={() => setConfirmCreate(false)}
      />
      <ConfirmModal
        open={creating !== null}
        title={
          creating?.on
            ? `Let “${creating.key.name}” create in Creatives?`
            : `Stop “${creating?.key.name ?? ''}” creating in Creatives?`
        }
        message={
          creating?.on
            ? `Its AI can then make images and clips on Higgsfield, which SPENDS the team’s Creatives budget, and save post ideas. It always tells the price and asks first; it can never spend more than $${limits.max_per_generation_usd.toFixed(2)} on one generation or $${limits.max_per_key_day_usd.toFixed(0)} a day, and never past the monthly cap. Everything it makes is labelled “${limits.label}”. Reading stays as it is.`
            : 'It goes back to reading only. Anything it already started finishes and stays in the Gallery.'
        }
        confirmLabel={creating?.on ? 'Allow' : 'Stop it'}
        cancelLabel="Cancel"
        danger={!creating?.on}
        onConfirm={toggleCreate}
        onCancel={() => setCreating(null)}
      />
      <ConfirmModal
        open={revoking !== null}
        title={`Revoke “${revoking?.name ?? ''}”?`}
        message="The connector using it stops working immediately. This cannot be undone — make a new key to reconnect."
        confirmLabel="Revoke"
        cancelLabel="Keep it"
        danger
        onConfirm={revoke}
        onCancel={() => setRevoking(null)}
      />
    </section>
  )
}
