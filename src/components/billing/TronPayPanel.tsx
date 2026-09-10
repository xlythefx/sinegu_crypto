import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, Copy, FlaskConical, Loader2, TriangleAlert } from 'lucide-react'
import { getTronIntentStatus, simulateTronPayment } from '../../services/payments'
import { getApiErrorMessage } from '../../services/api'
import { useInterval } from '../../hooks/useInterval'
import type { TronIntent, TronIntentStatus, TronSettlement } from '../../types/payments'
import DevDetails from '../ui/DevDetails'

interface TronPayPanelProps {
  intent: TronIntent
  developer: boolean
  /** Fired once the chain (or the dev button) has settled the invoice. */
  onSettled: (settlement: TronSettlement) => void
}

/** Stop polling after this many ticks — roughly seven minutes at 10s. */
const MAX_POLLS = 40

const FIELD_LABEL = 'text-[10.5px] uppercase tracking-[0.1em] text-faint mb-1.5'
const FIELD_BOX =
  'flex items-center gap-2 rounded-[10px] border border-accent-line bg-surface2 py-2.5 px-3'
const COPY_BTN =
  'flex-shrink-0 inline-flex items-center gap-1.5 rounded-btn border border-border bg-surface py-1.5 px-2.5 text-[11.5px] font-bold text-text cursor-pointer transition-[border-color] duration-150 hover:border-accent'

function countdown(seconds: number): string {
  if (seconds <= 0) return 'expired'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * "Send exactly this, to this address." The whole rail's UI.
 *
 * Two things are load-bearing and must not be softened:
 *
 *  - the AMOUNT is shown at full precision and labelled as exact, because it is
 *    what identifies the payer. Most customers pay from an exchange withdrawal,
 *    where the sender address on chain belongs to the exchange rather than to
 *    them, so the figure is the only signal that survives the trip.
 *  - the NETWORK warning. USDT exists on several chains; sending on any of them
 *    other than TRON reaches an address nobody controls and the money is gone.
 *
 * Polling is bounded (see MAX_POLLS) and stops with an honest message rather
 * than spinning forever — and if the watcher itself has stalled, it says so,
 * because a payment nobody is scanning for will never settle on its own.
 *
 * Success is NOT rendered here: it is handed up via {@link onSettled} so the
 * sheet can replace itself with a proper confirmation.
 */
export default function TronPayPanel({ intent, developer, onSettled }: TronPayPanelProps) {
  const [status, setStatus] = useState<TronIntentStatus | null>(null)
  const [polls, setPolls] = useState(0)
  const [remaining, setRemaining] = useState(intent.secondsRemaining)
  const [copied, setCopied] = useState<'address' | 'amount' | null>(null)
  const [simulating, setSimulating] = useState(false)
  const [simError, setSimError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const seen = status?.transfer != null
  const watching = !done && polls < MAX_POLLS

  const settle = useCallback(
    (txHash: string | null, explorerUrl: string | null, simulated: boolean) => {
      setDone(true)
      onSettled({
        amount: intent.amount,
        asset: intent.asset,
        usdAmount: intent.usdAmount,
        txHash,
        explorerUrl,
        simulated,
      })
    },
    [intent, onSettled],
  )

  const load = useCallback(async () => {
    try {
      const next = await getTronIntentStatus(intent.invoiceId)
      setStatus(next)
      if (next.intent) setRemaining(next.intent.secondsRemaining)
      if (next.invoiceStatus === 'paid') {
        settle(next.transfer?.txHash ?? null, next.transfer?.explorerUrl ?? null, false)
      }
    } catch {
      // A failed poll is not worth a red banner — the next tick retries, and
      // the invoice settles server-side whether or not this tab is watching.
    }
  }, [intent.invoiceId, settle])

  useInterval(
    () => {
      setPolls((n) => n + 1)
      void load()
    },
    watching ? 10000 : null,
  )

  // A local tick so the countdown moves between polls.
  useInterval(() => setRemaining((s) => Math.max(0, s - 1)), watching ? 1000 : null)

  useEffect(() => {
    setStatus(null)
    setPolls(0)
    setDone(false)
    setSimError(null)
    setRemaining(intent.secondsRemaining)
  }, [intent.intentId, intent.secondsRemaining])

  const copy = useCallback(async (value: string, which: 'address' | 'amount') => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(which)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopied(null)
    }
  }, [])

  const simulate = useCallback(async () => {
    setSimulating(true)
    setSimError(null)
    try {
      const res = await simulateTronPayment(intent.invoiceId)
      settle(res.txHash, null, true)
    } catch (err) {
      setSimError(getApiErrorMessage(err, 'Could not simulate the payment.'))
    } finally {
      setSimulating(false)
    }
  }, [intent.invoiceId, settle])

  return (
    <div className="rounded-[14px] border border-accent bg-accent-soft p-4 max-[420px]:p-3.5">
      <p className="text-[13.5px] font-bold text-text mb-1">
        Send {intent.asset} on {intent.chainLabel}
      </p>
      <p className="text-[11.5px] text-muted leading-[1.5] mb-3">
        Send the exact amount below to this wallet. The invoice settles on its own
        within about a minute of the transfer confirming.
      </p>

      {/* The amount identifies the payment — most customers pay from an
          exchange, where the on-chain sender is the exchange, not them. */}
      <p className={FIELD_LABEL}>Exact amount</p>
      <div className={`${FIELD_BOX} mb-3`}>
        <code className="flex-1 min-w-0 font-mono text-[15px] font-bold text-text break-all">
          {intent.amount}
        </code>
        <span className="flex-shrink-0 font-mono text-[11.5px] text-muted">{intent.asset}</span>
        <button type="button" className={COPY_BTN} onClick={() => copy(intent.amount, 'amount')}>
          {copied === 'amount' ? <Check size={13} /> : <Copy size={13} />}
          {copied === 'amount' ? 'Copied' : 'Copy'}
        </button>
      </div>

      <p className={FIELD_LABEL}>To this address</p>
      <div className={FIELD_BOX}>
        <code className="flex-1 min-w-0 font-mono text-[11.5px] text-text break-all">
          {intent.address}
        </code>
        <button type="button" className={COPY_BTN} onClick={() => copy(intent.address, 'address')}>
          {copied === 'address' ? <Check size={13} /> : <Copy size={13} />}
          {copied === 'address' ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Unrecoverable if ignored: USDT exists on several chains and only the
          TRON one reaches this address. */}
      <p className="flex items-start gap-2 text-[11.5px] font-semibold text-red rounded-[10px] border border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)] py-2.5 px-3 leading-[1.45] mt-3">
        <TriangleAlert size={14} className="flex-shrink-0 mt-px" />
        Send on the <strong>TRON (TRC-20)</strong> network only. {intent.asset} sent
        over any other chain cannot be recovered.
      </p>

      <p className="text-[11.5px] text-muted leading-[1.5] mt-3 pt-3 border-t border-accent-line">
        If your exchange charges a withdrawal fee it comes out of the amount you
        send — we allow up to ${intent.tolerance.shortfallUsd.toFixed(2)} short, so you
        can enter the figure above as-is.
      </p>

      <div className="flex items-center gap-2 mt-3">
        {watching ? (
          <>
            <Loader2 size={14} className="text-accent animate-[dstate-spin_0.8s_linear_infinite]" />
            <span className="text-[11.5px] text-muted">
              {seen
                ? 'Transfer spotted — confirming on chain…'
                : `Watching for your payment… quote expires in ${countdown(remaining)}`}
            </span>
          </>
        ) : (
          <span className="text-[11.5px] text-muted">
            Still waiting. You can close this — the invoice settles on its own once
            the transfer confirms.
          </span>
        )}
      </div>

      {/* Polling is the ONLY way a TRON payment is noticed. If the watcher has
          stopped, say so rather than letting the spinner imply progress. */}
      {status?.scanStale && (
        <p className="flex items-start gap-2 text-[11.5px] font-semibold text-red mt-2.5">
          <AlertTriangle size={13} className="flex-shrink-0 mt-px" />
          Our payment watcher has not run recently. Your transfer is safe — it will
          be picked up once the watcher resumes.
        </p>
      )}

      {/* Developer test button. Only rendered when the SERVER says this network
          may be simulated, and the endpoint enforces the same rule again — the
          network that carries real money can never be settled this way. */}
      {intent.simulatable && (
        <div className="mt-3 pt-3 border-t border-dashed border-accent-line">
          <button
            type="button"
            className="w-full inline-flex items-center justify-center gap-2 rounded-pill border border-dashed border-accent-line bg-[var(--bubble)] py-2.5 px-4 text-[12.5px] font-bold text-accent cursor-pointer transition-[border-color,filter] duration-150 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={simulate}
            disabled={simulating}
          >
            {simulating ? (
              <Loader2 size={14} className="animate-[dstate-spin_0.8s_linear_infinite]" />
            ) : (
              <FlaskConical size={14} />
            )}
            {simulating ? 'Settling…' : 'Dev: mark as paid without sending'}
          </button>
          <p className="text-[11px] text-faint leading-[1.45] mt-2">
            Test networks only. Settles this invoice as if the transfer had arrived,
            recorded permanently as a simulated payment — so you can exercise the
            flow without a real transfer each time.
          </p>
          {simError && (
            <p className="flex items-start gap-2 text-[11.5px] font-semibold text-red mt-2">
              <AlertTriangle size={13} className="flex-shrink-0 mt-px" />
              {simError}
            </p>
          )}
        </div>
      )}

      {developer && (
        <DevDetails
          title={`TRON intent · ${intent.network}`}
          debug={{
            status: 200,
            errorCode: intent.network,
            message: `Reserved ${intent.amount} ${intent.asset} (${intent.amountUnits} base units) for invoice ${intent.invoiceId}.`,
            detail: {
              intent_id: intent.intentId,
              reused: intent.reused,
              simulatable: intent.simulatable,
              contract_address: intent.contractAddress,
              tolerance: intent.tolerance,
              last_scan_at: status?.lastScanAt ?? null,
              scan_stale: status?.scanStale ?? null,
              transfer: status?.transfer ?? null,
              ...(intent.debug ?? {}),
            },
          }}
          defaultOpen={false}
        />
      )}
    </div>
  )
}
