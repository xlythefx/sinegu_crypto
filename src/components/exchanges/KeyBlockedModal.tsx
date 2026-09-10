import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Unplug,
  X,
} from 'lucide-react'
import { FALLBACK_SERVER_IP } from '../../lib/serverIp'
import type { ExchangeAccount } from '../../types/exchanges'

interface KeyBlockedModalProps {
  open: boolean
  account: ExchangeAccount
  /** IP the user must allow-list; falls back to the known prod address. */
  serverIp: string | null
  onClose: () => void
  /** Re-test the key against the exchange (the balance-refresh call). */
  onRecheck: () => Promise<void>
  /** Confirmed disconnect, so they can connect a fresh key. */
  onDisconnect: () => void
}

/** Whole days left before the account is disconnected automatically. */
function daysLeft(graceEndsAt: string | null | undefined): number | null {
  if (!graceEndsAt) return null
  const end = new Date(graceEndsAt).getTime()
  if (Number.isNaN(end)) return null
  return Math.max(0, Math.ceil((end - Date.now()) / 86_400_000))
}

/**
 * Shown when the exchange refuses an account's API key from our server —
 * nearly always an IP allow-list on the key that does not include us.
 *
 * The failure is invisible without this: the account still says "connected",
 * its balance quietly stops moving, and it takes no trades. So the modal leads
 * with the consequence ("not receiving trades"), gives the one thing that fixes
 * it (the IP, copyable), and offers the two ways out — recheck after fixing, or
 * disconnect and connect a fresh key.
 */
export default function KeyBlockedModal({
  open,
  account,
  serverIp,
  onClose,
  onRecheck,
  onDisconnect,
}: KeyBlockedModalProps) {
  const [copied, setCopied] = useState(false)
  const [rechecking, setRechecking] = useState(false)

  if (!open) return null

  const ip = serverIp || FALLBACK_SERVER_IP
  const remaining = daysLeft(account.key_grace_ends_at)
  const wrongKey = account.key_error_reason === 'BAD_KEY_FORMAT' ||
    account.key_error_reason === 'UNKNOWN_KEY' ||
    account.key_error_reason === 'BAD_SIGNATURE'

  const copyIp = async () => {
    try {
      await navigator.clipboard.writeText(ip)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the address is selectable below */
    }
  }

  const recheck = async () => {
    setRechecking(true)
    try {
      await onRecheck()
    } finally {
      setRechecking(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex justify-center overflow-y-auto bg-[var(--bgScrim)] p-4 backdrop-blur-[4px] max-[420px]:p-3 sm:p-6 animate-[fadeup_0.2s_ease_both]"
      role="dialog"
      aria-modal="true"
      aria-label="Exchange connection needs attention"
      onClick={onClose}
    >
      <div
        className="relative my-auto flex w-full max-w-[520px] flex-col overflow-hidden rounded-[20px] border border-border bg-surface shadow-[0_30px_80px_rgba(0,0,0,0.4)] animate-[fadeup_0.28s_cubic-bezier(0.2,0.7,0.2,1)_both]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex flex-shrink-0 items-start gap-3 border-b border-hair p-5 pr-14 max-[420px]:p-4 max-[420px]:pr-12">
          <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-[11px] border border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_12%,transparent)] text-red">
            <ShieldAlert size={18} />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-[18px] font-extrabold leading-tight tracking-[-0.01em]">
              {account.name} is not receiving trades
            </h3>
            <p className="mt-1.5 text-[12.5px] text-muted">
              Binance is refusing this API key from our server.
            </p>
          </div>
          <button
            type="button"
            className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-btn bg-transparent text-faint transition-colors duration-150 hover:bg-surface2 hover:text-text"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-5 max-[420px]:p-4">
          {remaining !== null && (
            <p className="flex items-start gap-2 rounded-[12px] border border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_12%,transparent)] px-3.5 py-2.5 text-[12px] font-semibold leading-[1.45] text-red">
              <AlertTriangle size={15} className="mt-px flex-shrink-0" />
              {remaining === 0
                ? 'This account will be disconnected today if the key is not fixed.'
                : `Fix it within ${remaining} ${remaining === 1 ? 'day' : 'days'} or the account is disconnected automatically, so you can connect a new key.`}
            </p>
          )}

          {wrongKey ? (
            <section>
              <p className="text-[13px] leading-[1.6] text-text">
                The key itself is not valid any more — it may have been deleted or
                regenerated on Binance. Disconnect this account and connect a fresh
                trade-only key.
              </p>
            </section>
          ) : (
            <section>
              <p className="text-[13px] leading-[1.6] text-text">
                Your API key is restricted to specific IP addresses, and ours is not
                on the list. Add this address in Binance → API Management → edit the
                key → <em>Restrict access to trusted IPs</em>:
              </p>

              <div className="mt-3 flex items-center gap-2 rounded-[12px] border border-accent bg-accent-soft px-3 py-2.5">
                <code className="min-w-0 flex-1 break-all font-mono text-[15px] font-bold tracking-[0.02em] text-text">
                  {ip}
                </code>
                <button
                  type="button"
                  className="inline-flex flex-none items-center gap-1.5 rounded-btn border border-border bg-surface px-2.5 py-1.5 text-[11.5px] font-bold text-text transition-[border-color] duration-150 hover:border-accent"
                  onClick={copyIp}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              <ol className="mt-3.5 flex list-decimal flex-col gap-1.5 pl-4 text-[12.5px] leading-[1.55] text-muted">
                <li>Open Binance → API Management and edit this key.</li>
                <li>Paste the address above into the trusted-IP list and save.</li>
                <li>
                  Keep <strong className="text-text">Enable Futures</strong> ticked —
                  the key must be able to trade, never to withdraw.
                </li>
                <li>Come back and press “I’ve added it — recheck”.</li>
              </ol>

              <a
                className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-accent hover:underline"
                href="https://www.binance.com/en/my/settings/api-management"
                target="_blank"
                rel="noreferrer noopener"
              >
                Open Binance API Management <ExternalLink size={12} />
              </a>
            </section>
          )}

          {account.key_error_message && (
            <p className="rounded-[10px] border border-hair bg-surface2 px-3 py-2 font-mono text-[11px] leading-[1.5] text-faint">
              {account.key_error_code} · {account.key_error_message}
            </p>
          )}
        </div>

        <footer className="flex flex-shrink-0 flex-col-reverse gap-2.5 border-t border-hair bg-surface p-5 max-[430px]:w-full sm:flex-row sm:justify-end max-[420px]:p-4">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-pill border border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-transparent px-[18px] py-3 text-[13px] font-bold text-red transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--red)_12%,transparent)]"
            onClick={onDisconnect}
          >
            <Unplug size={15} />
            Disconnect account
          </button>
          {!wrongKey && (
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-pill border-0 bg-accent px-[22px] py-3 text-[13.5px] font-bold text-on-accent shadow-[0_10px_24px_var(--glow)] transition-[filter,transform] duration-150 hover:brightness-[1.06] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
              onClick={recheck}
              disabled={rechecking}
            >
              {rechecking ? (
                <Loader2 size={15} className="animate-[dstate-spin_0.8s_linear_infinite]" />
              ) : (
                <RefreshCw size={15} />
              )}
              {rechecking ? 'Checking…' : 'I’ve added it — recheck'}
            </button>
          )}
        </footer>
      </div>
    </div>,
    document.body,
  )
}
