import { useState } from 'react'
import { Check, Copy, Eye, EyeOff, Pencil, Trash2 } from 'lucide-react'
import type { ExchangeAccount, ExchangeKind } from '../../types/exchanges'
import { EXCHANGE_META } from './meta'
import { maskSecret } from '../../lib/mask'

interface ExchangeAccountCardProps {
  account: ExchangeAccount
  exchange: ExchangeKind
  onRename: (account: ExchangeAccount) => void
  onDisconnect: (account: ExchangeAccount) => void
}

/** Ghost square icon button — hover lifts to surface2 + full text color. */
const ICON_BTN =
  'flex h-7 w-7 flex-none items-center justify-center rounded-btn bg-transparent text-muted transition-colors duration-150 hover:bg-surface2 hover:text-text'

/** Uppercase mono field caption (BALANCE / API KEY / SECRET KEY). */
const FIELD_LABEL =
  'font-mono text-[10px] font-semibold tracking-[0.12em] text-faint'

const BADGE_BASE =
  'rounded-pill border px-[9px] py-[3px] text-[10.5px] font-bold whitespace-nowrap'

function formatBalance(value: string | null, currency: string): string {
  if (value === null) return '—'
  const n = Number(value)
  if (Number.isNaN(n)) return '—'
  return `${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`
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
      {copied ? <Check size={14} className="text-green" /> : <Copy size={14} />}
    </button>
  )
}

export default function ExchangeAccountCard({
  account,
  exchange,
  onRename,
  onDisconnect,
}: ExchangeAccountCardProps) {
  const meta = EXCHANGE_META[exchange]
  const [showKey, setShowKey] = useState(false)

  return (
    <article className="flex flex-col gap-stack rounded-card border border-border bg-surface p-card">
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className="flex h-11 w-11 flex-none items-center justify-center rounded-row border font-display text-[20px] font-extrabold"
            style={{
              color: meta.color,
              background: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
              borderColor: `color-mix(in srgb, ${meta.color} 35%, transparent)`,
            }}
          >
            {meta.label[0]}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14.5px] font-bold">{account.name}</p>
            <p className="mt-px text-[12px] text-muted">{meta.label}</p>
          </div>
        </div>
        <div className="flex flex-none flex-wrap items-center justify-end gap-1.5">
          <span
            className={`${BADGE_BASE} ${
              account.enabled
                ? 'border-[rgba(61,220,151,0.35)] bg-[rgba(61,220,151,0.12)] text-green'
                : 'border-border bg-surface2 text-muted'
            }`}
          >
            {account.enabled ? 'Active' : 'Disabled'}
          </span>
          <span
            className={`${BADGE_BASE} ${
              account.demo
                ? 'border-border bg-surface2 text-muted'
                : 'border-accent-line bg-accent-soft text-accent'
            }`}
          >
            {account.demo ? 'Demo' : 'Live'}
          </span>
          <button
            type="button"
            className={`${ICON_BTN} hover:bg-accent-soft hover:text-accent`}
            onClick={() => onRename(account)}
            aria-label={`Rename ${account.name}`}
            title="Rename account"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            className={`${ICON_BTN} hover:bg-[rgba(255,90,90,0.1)] hover:text-red`}
            onClick={() => onDisconnect(account)}
            aria-label={`Disconnect ${account.name}`}
            title="Disconnect"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div>
        <span className={FIELD_LABEL}>BALANCE</span>
        <p className="mt-[3px] font-display text-[24px] font-extrabold tracking-[-0.02em]">
          {formatBalance(account.balance, account.currency_type)}
        </p>
      </div>

      <div className="flex flex-col gap-3 border-t border-hair pt-3.5">
        <div>
          <span className={FIELD_LABEL}>API KEY</span>
          <div className="mt-1 flex items-center gap-1">
            <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-text">
              {maskSecret(account.api_key, showKey)}
            </code>
            <button
              type="button"
              className={ICON_BTN}
              onClick={() => setShowKey((v) => !v)}
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
              title={showKey ? 'Hide API key' : 'Show API key'}
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <CopyButton value={account.api_key} label="API key" />
          </div>
        </div>

        <div>
          <span className={FIELD_LABEL}>SECRET KEY</span>
          <span className="mt-1 block text-[12px] italic text-muted">
            Stored securely
          </span>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between pt-3 text-[11px] text-faint">
        <span>Created {formatCreatedDate(account.created_at)}</span>
        <span className="font-mono">{account.currency_type}</span>
      </div>
    </article>
  )
}
