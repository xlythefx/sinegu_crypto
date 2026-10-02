import { AlertTriangle, Check, ExternalLink, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { SUPPORT_EMAIL, SUPPORT_TELEGRAM_HANDLE, SUPPORT_TELEGRAM_URL } from '../../lib/company'

export type TronStage = 'waiting' | 'confirming' | 'expired'

interface TronPaymentStatusProps {
  stage: TronStage
  amount: string
  asset: string
  /** Seconds the quote is still valid for. */
  remaining: number
  /** Seconds since this address was shown. */
  elapsed: number
  /** Seconds since the last successful check, null before the first one. */
  checkedAgo: number | null
  /** The server-side watcher has not scanned recently. */
  scanStale: boolean
  explorerUrl: string | null
  /** Reserve a fresh amount + address after the quote expired. */
  onRenew?: () => void
  renewing?: boolean
}

function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

const STEPS = ['Send', 'Spotted', 'Paid'] as const

/**
 * The "what is happening right now" block of the manual TRC-20 payment.
 *
 * Written for someone who just pressed Send in their exchange app and is
 * staring at this window: one plain headline, one instruction (keep this
 * open), and proof that something is actually running — a waiting timer and
 * "checked Xs ago" — so a quiet minute never reads as a frozen page.
 *
 * It says "keep this window open" AND that closing is safe, because both are
 * true: the window is where the confirmation appears, but settlement is
 * server-side and never depends on this tab.
 */
export default function TronPaymentStatus({
  stage,
  amount,
  asset,
  remaining,
  elapsed,
  checkedAgo,
  scanStale,
  explorerUrl,
  onRenew,
  renewing = false,
}: TronPaymentStatusProps) {
  const activeStep = stage === 'confirming' ? 1 : 0

  return (
    <div className="flex flex-col gap-3">
      {/* step tracker */}
      <ol className="grid grid-cols-3 gap-1.5" aria-label="Payment progress">
        {STEPS.map((label, i) => {
          const done = i < activeStep
          const active = i === activeStep && stage !== 'expired'
          return (
            <li key={label} className="flex flex-col gap-1.5 min-w-0">
              <span
                className={`h-1.5 rounded-pill ${
                  done
                    ? 'bg-green'
                    : active
                      ? 'bg-accent animate-pulse motion-reduce:animate-none'
                      : 'bg-border'
                }`}
              />
              <span
                className={`flex items-center gap-1 text-[11px] font-bold truncate ${
                  done ? 'text-green' : active ? 'text-text' : 'text-faint'
                }`}
              >
                {done && <Check size={11} strokeWidth={3} className="flex-shrink-0" />}
                {i + 1}. {label}
              </span>
            </li>
          )
        })}
      </ol>

      {stage === 'expired' ? (
        <div
          className="rounded-[12px] border border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)] p-3.5"
          role="status"
        >
          <p className="flex items-center gap-2 text-[14px] font-extrabold text-text">
            <AlertTriangle size={16} className="text-red flex-shrink-0" />
            This payment address has expired
          </p>
          <ul className="text-[12px] text-muted leading-[1.55] mt-2 flex flex-col gap-1.5 pl-1">
            <li>
              <strong className="text-text">Haven't sent yet?</strong> Get a new address below
              and send to that one.
            </li>
            <li>
              <strong className="text-text">Already sent?</strong> Do NOT send again. Message{' '}
              <a
                href={SUPPORT_TELEGRAM_URL}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-accent underline underline-offset-2"
              >
                {SUPPORT_TELEGRAM_HANDLE}
              </a>{' '}
              or{' '}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-bold text-accent underline underline-offset-2"
              >
                {SUPPORT_EMAIL}
              </a>{' '}
              with your transaction ID — we'll match it to this invoice by hand.
            </li>
          </ul>
          {onRenew && (
            <button
              type="button"
              className="w-full mt-3 inline-flex items-center justify-center gap-2 rounded-pill bg-accent text-on-accent py-2.5 px-4 text-[13px] font-bold cursor-pointer transition-[filter] duration-150 hover:brightness-[1.06] disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={onRenew}
              disabled={renewing}
            >
              {renewing ? (
                <Loader2 size={15} className="animate-[dstate-spin_0.8s_linear_infinite]" />
              ) : (
                <RefreshCw size={15} />
              )}
              {renewing ? 'Getting a new address…' : 'Get a new payment address'}
            </button>
          )}
        </div>
      ) : (
        <div
          className={`rounded-[12px] border p-3.5 ${
            stage === 'confirming'
              ? 'border-[color-mix(in_srgb,var(--green)_40%,transparent)] bg-[color-mix(in_srgb,var(--green)_9%,transparent)]'
              : 'border-accent-line bg-surface2'
          }`}
          role="status"
          aria-live="polite"
        >
          <p className="flex items-center gap-2 text-[14px] font-extrabold text-text">
            <Loader2
              size={16}
              className={`flex-shrink-0 animate-[dstate-spin_0.8s_linear_infinite] ${
                stage === 'confirming' ? 'text-green' : 'text-accent'
              }`}
            />
            {stage === 'confirming'
              ? 'Payment found — confirming…'
              : 'Waiting for your payment…'}
          </p>

          <p className="text-[12.5px] font-bold text-text mt-2 leading-[1.45]">
            Please keep this window open.
          </p>
          <p className="text-[12px] text-muted leading-[1.5] mt-0.5">
            {stage === 'confirming' ? (
              <>
                We can see your transfer on the blockchain. It usually confirms within
                about a minute — this window will show it the moment it does.
              </>
            ) : (
              <>
                <span className="block text-[12.5px] font-bold text-text mb-0.5">
                  Please send the exact amount:{' '}
                  <span className="font-mono text-accent">
                    {amount} {asset}
                  </span>
                </span>
                Once you've sent it, it normally appears here within 1–3 minutes —
                exchanges can take longer to release a withdrawal.
              </>
            )}
          </p>

          {/* proof of life: the page is working even when nothing changes */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5 pt-2.5 border-t border-hair font-mono text-[11px] text-faint">
            <span>
              Waiting <span className="text-muted font-bold">{clock(elapsed)}</span>
            </span>
            <span>
              Last check{' '}
              <span className="text-muted font-bold">
                {checkedAgo == null ? '…' : checkedAgo < 3 ? 'just now' : `${checkedAgo}s ago`}
              </span>
            </span>
            {stage === 'waiting' && (
              <span>
                Address valid <span className="text-muted font-bold">{clock(remaining)}</span>
              </span>
            )}
          </div>

          {stage === 'confirming' && explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-accent mt-2"
            >
              <ExternalLink size={12} /> View the transfer on the blockchain
            </a>
          )}

          <p className="flex items-start gap-1.5 text-[11px] text-faint leading-[1.45] mt-2.5">
            <ShieldCheck size={12} className="flex-shrink-0 mt-px text-accent" />
            <span>
              If you close this by accident your payment still counts — the invoice
              updates on its own. Just don't send a second time.
            </span>
          </p>
        </div>
      )}

      {scanStale && stage !== 'expired' && (
        <p className="flex items-start gap-2 text-[11.5px] font-semibold text-red">
          <AlertTriangle size={13} className="flex-shrink-0 mt-px" />
          <span>
            Our payment checker is running behind right now. Your transfer is safe — it
            will be picked up as soon as the checker catches up.
          </span>
        </p>
      )}
    </div>
  )
}
