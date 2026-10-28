import { useEffect, useState } from 'react'
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  FlaskConical,
  KeyRound,
  Lock,
  Pencil,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Wallet,
} from 'lucide-react'
import ExchangeLogo from './ExchangeLogo'
import KeyBlockedModal from './KeyBlockedModal'
import type { ExchangeAccount, ExchangeKind } from '../../types/exchanges'
import { EXCHANGE_COPY, keyFault } from './exchangeCopy'
import { EXCHANGE_META } from './meta'
import { maskSecret } from '../../lib/mask'
import { refreshAccountBalance } from '../../services/exchanges'
import { ApiError, getApiErrorMessage } from '../../services/api'

interface ExchangeAccountCardProps {
  account: ExchangeAccount
  exchange: ExchangeKind
  onRename: (account: ExchangeAccount) => void
  onDisconnect: (account: ExchangeAccount) => void
  /** Fired with the updated row after a successful manual balance refresh. */
  onBalanceRefreshed?: (account: ExchangeAccount) => void
  /** The IP a user must allow-list on their API key. */
  serverIp?: string | null
}

/** Ghost square icon button — 36px, 44px on phones (tap target). */
const ICON_BTN =
  'flex h-9 w-9 flex-none items-center justify-center rounded-btn bg-transparent text-muted transition-colors duration-150 hover:bg-surface2 hover:text-text max-[640px]:h-11 max-[640px]:w-11'

/** The header's rename / disconnect buttons: the same, with an outline. */
const ACTION_BTN = `${ICON_BTN} border border-border`

/** Uppercase mono field caption (BALANCE / API KEY / SECRET KEY). */
const FIELD_LABEL =
  'font-mono text-[10px] font-semibold tracking-[0.12em] text-faint'

const CHIP =
  'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-[3px] text-[11px] font-bold whitespace-nowrap'

/** Splits a balance into its figure and unit; null when nothing is on record. */
function formatAmount(value: string | null): string | null {
  if (value === null) return null
  const n = Number(value)
  if (Number.isNaN(n)) return null
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatCreatedDate(dateStr: string): string {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  })
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable — ignore */
    }
  }
  return (
    <button
      type="button"
      className={ICON_BTN}
      onClick={handleCopy}
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
    >
      {copied ? <Check size={15} className="text-green" /> : <Copy size={15} />}
    </button>
  )
}

export default function ExchangeAccountCard({
  account,
  exchange,
  onRename,
  onDisconnect,
  onBalanceRefreshed,
  serverIp,
}: ExchangeAccountCardProps) {
  const meta = EXCHANGE_META[exchange]
  const copy = EXCHANGE_COPY[exchange]
  const [showKey, setShowKey] = useState(false)
  const [keyModalOpen, setKeyModalOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  /** Seconds left on the cooldown; 0 means the button is armed. */
  const [cooldown, setCooldown] = useState(0)
  const [syncNote, setSyncNote] = useState<string | null>(null)

  // One timer per remaining second, so nothing is left running at zero.
  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])

  const handleRefresh = async () => {
    if (syncing || cooldown > 0) return
    setSyncing(true)
    setSyncNote(null)
    try {
      const { account: fresh, retryAfter } = await refreshAccountBalance(account)
      onBalanceRefreshed?.(fresh)
      setCooldown(retryAfter)
      setSyncNote('Updated just now')
      window.setTimeout(() => setSyncNote(null), 4000)
    } catch (err) {
      // The server owns the cooldown, so a 429 tells us what the real remaining
      // time is — a reload must not hand out a fresh 60 seconds of clicking.
      if (err instanceof ApiError && err.status === 429) {
        const payload = err.payload as { retry_after?: number } | undefined
        setCooldown(Math.max(1, Number(payload?.retry_after) || 60))
      }
      setSyncNote(getApiErrorMessage(err, 'Could not refresh the balance.'))
    } finally {
      setSyncing(false)
    }
  }

  const keyBlocked = account.key_status === 'blocked'
  // The strip is the whole warning most people ever read, so it names the
  // fault rather than "refusing this API key" for all three of them.
  const keyStripNote =
    keyFault(exchange, account.key_error_reason) === 'tradePermission'
      ? `${meta.label} will not let this key trade — tap to fix.`
      : `${meta.label} is refusing this API key — tap to fix.`

  const amount = formatAmount(account.balance)
  const openPnl = account.unrealized_pnl === null ? 0 : Number(account.unrealized_pnl) || 0
  // An empty wallet is the commonest reason a healthy key never trades, and
  // nothing else on the card says where the money has to be.
  const walletEmpty = amount !== null && Number(account.balance) === 0

  return (
    <article
      className={`relative flex flex-col overflow-hidden rounded-card border bg-surface transition-[border-color,box-shadow] duration-200 hover:shadow-[0_14px_36px_rgba(0,0,0,0.18)] ${
        keyBlocked
          ? 'border-[color-mix(in_srgb,var(--red)_45%,transparent)]'
          : 'border-border hover:border-[color-mix(in_srgb,var(--accent)_30%,var(--border))]'
      }`}
    >
      {/* A wash of the venue's colour behind the header, so the card reads as
          "the Binance one" before the name is read. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-32"
        style={{
          background: `radial-gradient(120% 100% at 0% 0%, color-mix(in srgb, ${meta.color} 13%, transparent), transparent 70%)`,
        }}
      />

      <div className="relative flex flex-1 flex-col gap-stack p-card">
        {/* The failure is otherwise invisible: the card still says "connected"
            while the balance quietly freezes and no trades arrive. */}
        {keyBlocked && (
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-row border border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_12%,transparent)] px-3.5 py-2.5 text-left transition-[filter] duration-150 hover:brightness-110"
            onClick={() => setKeyModalOpen(true)}
          >
            <ShieldAlert size={16} className="flex-none text-red" />
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-bold text-red">
                Not receiving trades
              </span>
              <span className="block text-[11.5px] text-muted">{keyStripNote}</span>
            </span>
          </button>
        )}

        <KeyBlockedModal
          open={keyModalOpen}
          account={account}
          exchange={exchange}
          serverIp={serverIp ?? null}
          onClose={() => setKeyModalOpen(false)}
          onRecheck={handleRefresh}
          onDisconnect={() => {
            setKeyModalOpen(false)
            onDisconnect(account)
          }}
        />

        <header className="flex items-start gap-3.5">
          <ExchangeLogo
            kind={exchange}
            size={48}
            className="shadow-[0_6px_18px_rgba(0,0,0,0.22)]"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[16px] font-extrabold tracking-[-0.01em]">
              {account.name}
            </p>
            <p className="mt-px text-[12px] text-muted">
              {meta.label} · {account.demo ? 'Demo trading' : 'Live trading'}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span
                className={`${CHIP} ${
                  account.enabled
                    ? 'border-[color-mix(in_srgb,var(--green)_35%,transparent)] bg-[color-mix(in_srgb,var(--green)_12%,transparent)] text-green'
                    : 'border-border bg-surface2 text-muted'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${account.enabled ? 'bg-green' : 'bg-faint'}`}
                />
                {account.enabled ? 'Active' : 'Disabled'}
              </span>
              {account.demo ? (
                <span className={`${CHIP} border-border bg-surface2 text-muted`}>
                  <FlaskConical size={11} />
                  Demo
                </span>
              ) : (
                <span className={`${CHIP} border-accent-line bg-accent-soft text-accent`}>
                  Live
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-none items-center gap-1.5">
            <button
              type="button"
              className={`${ACTION_BTN} hover:border-accent-line hover:bg-accent-soft hover:text-accent`}
              onClick={() => onRename(account)}
              aria-label={`Rename ${account.name}`}
              title="Rename account"
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              className={`${ACTION_BTN} hover:border-[color-mix(in_srgb,var(--red)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--red)_10%,transparent)] hover:text-red`}
              onClick={() => onDisconnect(account)}
              aria-label={`Disconnect ${account.name}`}
              title="Disconnect"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </header>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={FIELD_LABEL}>BALANCE</span>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-border bg-surface px-3 text-[11.5px] font-bold text-muted transition-colors duration-150 hover:border-accent hover:text-text disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-border disabled:hover:text-muted max-[640px]:h-10"
              onClick={handleRefresh}
              disabled={syncing || cooldown > 0}
              aria-label={`Refresh balance for ${account.name}`}
              title={
                cooldown > 0
                  ? `Available again in ${cooldown}s`
                  : 'Fetch the live balance from the exchange'
              }
            >
              <RefreshCw
                size={12}
                className={syncing ? 'animate-[dstate-spin_0.8s_linear_infinite]' : undefined}
              />
              {syncing ? 'Syncing…' : cooldown > 0 ? `Wait ${cooldown}s` : 'Refresh'}
            </button>
          </div>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-[28px] font-extrabold leading-tight tracking-[-0.02em]">
              {amount ?? '—'}
            </span>
            {amount !== null && (
              <span className="font-mono text-[12px] font-semibold text-muted">
                {account.currency_type}
              </span>
            )}
          </p>
          {openPnl !== 0 && (
            <p className="mt-0.5 text-[12px] text-muted">
              Open P&amp;L{' '}
              <span className={`font-mono font-semibold ${openPnl > 0 ? 'text-green' : 'text-red'}`}>
                {openPnl > 0 ? '+' : '−'}
                {Math.abs(openPnl).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </p>
          )}
          {syncNote ? (
            <p className="mt-1.5 text-[11.5px] text-muted">{syncNote}</p>
          ) : account.balance === null ? (
            <p className="mt-1.5 text-[11.5px] text-faint">
              Awaiting first sync — press Refresh to pull it now.
            </p>
          ) : (
            walletEmpty && (
              <p className="mt-2 flex items-start gap-2 rounded-row border border-hair bg-surface2 px-3 py-2 text-[11.5px] leading-[1.5] text-muted">
                <Wallet size={14} className="mt-px flex-none text-accent" />
                <span>
                  Nothing in your {meta.label} {copy.walletName} yet. The bot only
                  trades the money in it.
                </span>
              </p>
            )
          )}
        </section>

        <section className="flex flex-col rounded-row border border-hair bg-surface2">
          <div className="flex items-center gap-3 px-3.5 py-2.5">
            <KeyRound size={15} className="flex-none text-faint" />
            <div className="min-w-0 flex-1">
              <span className={FIELD_LABEL}>API KEY</span>
              <code className="mt-0.5 block truncate font-mono text-[12.5px] text-text">
                {maskSecret(account.api_key, showKey)}
              </code>
            </div>
            <button
              type="button"
              className={ICON_BTN}
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
              title={showKey ? 'Hide API key' : 'Show API key'}
            >
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            <CopyButton value={account.api_key} label="API key" />
          </div>
          <div className="flex items-center gap-3 border-t border-hair px-3.5 py-2.5">
            <Lock size={15} className="flex-none text-faint" />
            <div className="min-w-0 flex-1">
              <span className={FIELD_LABEL}>SECRET KEY</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
                <ShieldCheck size={13} className="flex-none text-green" />
                Kept on our server — never shown again
              </span>
            </div>
          </div>
        </section>

        <footer className="mt-auto text-[11px] text-faint">
          Connected {formatCreatedDate(account.created_at)}
        </footer>
      </div>
    </article>
  )
}
