import { useState, type FormEvent } from 'react'
import { AlertTriangle, Check, Loader2, SearchCheck, ShieldAlert } from 'lucide-react'
import { claimTronPayment } from '../../services/payments'
import { getApiErrorMessage } from '../../services/api'
import { fmtCryptoAmount, fmtDateTime } from '../../lib/format'
import { SUPPORT_EMAIL } from '../../lib/company'
import type { TronClaimPrompt as Prompt, TronClaimResult } from '../../types/payments'

interface TronClaimPromptProps {
  invoiceId: number | string
  prompt: Prompt
  /** The claim settled this invoice. */
  onPaid: (result: TronClaimResult) => void
  /** The prompt moved to a new state (e.g. disputed) without settling. */
  onChange?: (prompt: Prompt | null) => void
}

const INPUT =
  'w-full min-w-0 rounded-[10px] border border-border bg-surface py-2.5 px-3 font-mono text-[12.5px] text-text placeholder:text-faint outline-none transition-[border-color] duration-150 focus:border-accent'
const BTN =
  'inline-flex flex-none items-center justify-center gap-2 rounded-pill bg-accent py-2.5 px-4 text-[12.5px] font-bold text-on-accent cursor-pointer transition-[filter] duration-150 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed'

/**
 * "We received a payment of this amount — is it yours?"
 *
 * Shown only when the server says so (`claim` on the intent status): a payment
 * arrived that this invoice COULD own, but so could another customer's, or it
 * came after this customer's timer ran out. The transaction ID settles it.
 *
 * The ID is never shown here — it is what the customer proves they have, from
 * their own exchange's withdrawal history. A `disputed` answer is not an error:
 * the payment is already on someone else's invoice, the team has been told,
 * and the customer just needs to know a human is on it.
 */
export default function TronClaimPrompt({ invoiceId, prompt, onPaid, onChange }: TronClaimPromptProps) {
  const [txHash, setTxHash] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amount = prompt.amount ? `${fmtCryptoAmount(prompt.amount)} ${prompt.asset}` : 'a payment'
  const seen = prompt.seenAt ? fmtDateTime(prompt.seenAt) : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!txHash.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await claimTronPayment(invoiceId, txHash.trim())
      if (res.invoiceStatus === 'paid') onPaid(res)
      else onChange?.(res.claim)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not check that transaction ID. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  if (prompt.state === 'disputed') {
    return (
      <div className="flex items-start gap-3 rounded-[14px] border border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)] p-4 max-[420px]:p-3.5">
        <ShieldAlert size={18} className="mt-0.5 flex-none text-red" />
        <div className="min-w-0">
          <p className="text-[13.5px] font-bold text-text">Our team is reviewing this payment</p>
          <p className="mt-1 text-[12.5px] leading-[1.55] text-muted">
            The {amount} payment you confirmed is already matched to another invoice. We have
            been alerted and will contact you. Keep your exchange&apos;s withdrawal record for
            it. Questions: {SUPPORT_EMAIL}.
          </p>
        </div>
      </div>
    )
  }

  const needed = prompt.state === 'needed'

  return (
    <form
      onSubmit={submit}
      className={`rounded-[14px] border p-4 max-[420px]:p-3.5 ${
        needed ? 'border-accent bg-accent-soft' : 'border-border bg-surface2'
      }`}
    >
      <div className="flex items-start gap-3">
        <SearchCheck size={18} className={`mt-0.5 flex-none ${needed ? 'text-accent' : 'text-muted'}`} />
        <div className="min-w-0">
          <p className="text-[13.5px] font-bold text-text">
            {needed ? `Did you send ${amount}?` : `Was this ${amount} payment yours?`}
          </p>
          <p className="mt-1 text-[12.5px] leading-[1.55] text-muted">
            {prompt.message}
            {seen && <> Received {seen}.</>}
          </p>
        </div>
      </div>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-[10.5px] uppercase tracking-[0.1em] text-faint">
          Transaction ID (TXID)
        </span>
        <div className="flex gap-2 max-[420px]:flex-col">
          <input
            className={INPUT}
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            placeholder="Paste the TXID or the Tronscan link"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className={BTN} disabled={busy || !txHash.trim()}>
            {busy ? <Loader2 size={14} className="animate-[dstate-spin_0.8s_linear_infinite]" /> : <Check size={14} />}
            {busy ? 'Checking…' : 'Confirm'}
          </button>
        </div>
      </label>

      <p className="mt-2 text-[11.5px] leading-[1.5] text-faint">
        Find it in your exchange&apos;s withdrawal history (Binance: Wallet → Transaction
        History → Withdraw), or in your wallet app. It is 64 letters and numbers.
      </p>

      {error && (
        <p className="mt-2 flex items-start gap-2 text-[12px] font-semibold text-red">
          <AlertTriangle size={13} className="mt-px flex-none" />
          <span className="min-w-0">{error}</span>
        </p>
      )}
    </form>
  )
}
