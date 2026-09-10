import { useState } from 'react'
import {
  Check,
  Copy,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { recheckEngineKey } from '../../../services/admin'
import { getApiErrorMessage } from '../../../services/api'
import { fmtMediumDate } from '../../../lib/format'
import type { KeyIssuesData } from '../../../types/admin'

interface KeyIssuesCardProps {
  data: KeyIssuesData
  onChanged: () => void
}

/** IP_OR_PERMISSION → what support should actually tell the customer. */
const REASON_COPY: Record<string, string> = {
  IP_OR_PERMISSION: 'Our server IP is not on the key’s allow-list (or Futures is off).',
  BAD_KEY_FORMAT: 'The key is malformed — it was deleted or mistyped.',
  UNKNOWN_KEY: 'Binance does not recognise this key any more.',
  BAD_SIGNATURE: 'The secret does not match the key.',
}

const DEADLINE_TONE = (days: number | null): string => {
  if (days === null) return 'text-muted'
  return days <= 1 ? 'text-red' : 'text-accent'
}

/**
 * Accounts the exchange is currently refusing.
 *
 * This is the support view of an otherwise invisible failure: the customer's
 * account reads "connected", its balance is frozen, and it silently takes no
 * trades. Everything shown here comes from columns the engine already wrote,
 * so opening the page costs nothing at Binance — only "Recheck" talks to it.
 */
export default function KeyIssuesCard({ data, onChanged }: KeyIssuesCardProps) {
  const [busyId, setBusyId] = useState<number | null>(null)
  const [note, setNote] = useState<{ id: number; text: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const copyIp = async () => {
    if (!data.serverIp) return
    try {
      await navigator.clipboard.writeText(data.serverIp)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the address is selectable */
    }
  }

  const recheck = async (id: number) => {
    setBusyId(id)
    setNote(null)
    try {
      const result = await recheckEngineKey(id)
      setNote({ id, text: result.message })
      if (result.cleared) onChanged()
    } catch (err) {
      setNote({ id, text: getApiErrorMessage(err, 'Could not re-test the key.') })
    } finally {
      setBusyId(null)
    }
  }

  const count = data.accounts.length

  return (
    <section
      className="rounded-card border border-border bg-surface p-card"
      data-aos="fade-up"
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span
            className={`grid h-9 w-9 flex-none place-items-center rounded-[11px] border ${
              count === 0
                ? 'border-[color-mix(in_srgb,var(--green)_35%,transparent)] bg-[color-mix(in_srgb,var(--green)_10%,transparent)] text-green'
                : 'border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_12%,transparent)] text-red'
            }`}
          >
            {count === 0 ? <ShieldCheck size={17} /> : <ShieldAlert size={17} />}
          </span>
          <div>
            <h2 className="font-display text-[15px] font-extrabold">
              API key issues
            </h2>
            <p className="mt-px text-[12px] text-muted">
              {count === 0
                ? 'Every connected account is being accepted by the exchange.'
                : `${count} account${count === 1 ? '' : 's'} refused by the exchange — not receiving trades.`}
            </p>
          </div>
        </div>

        {data.serverIp && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface2 px-3 py-1.5 font-mono text-[12px] font-bold text-text transition-[border-color] duration-150 hover:border-accent"
            onClick={copyIp}
            title="The address customers must allow-list"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {data.serverIp}
          </button>
        )}
      </header>

      {count === 0 ? (
        <p className="rounded-row border border-dashed border-border bg-surface2 px-4 py-6 text-center text-[13px] text-muted">
          Nothing to fix. Blocked keys appear here within minutes of the engine
          being refused.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {data.accounts.map((a) => (
            <article
              key={a.id}
              className="rounded-row border border-[color-mix(in_srgb,var(--red)_28%,transparent)] bg-[color-mix(in_srgb,var(--red)_6%,transparent)] p-3.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/admin/users/${a.uni_id}`}
                      className="text-[13.5px] font-bold text-text hover:text-accent hover:underline"
                    >
                      {a.owner_name || a.uni_id}
                    </Link>
                    <span className="rounded-pill border border-border bg-surface2 px-2 py-[2px] font-mono text-[10px] font-semibold text-muted">
                      {a.demo ? 'DEMO' : 'LIVE'}
                    </span>
                    {a.error_code && (
                      <span className="rounded-pill border border-[color-mix(in_srgb,var(--red)_35%,transparent)] px-2 py-[2px] font-mono text-[10px] font-semibold text-red">
                        {a.error_code}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-[12px] text-muted">
                    {a.name} · {a.owner_email ?? '—'} ·{' '}
                    <span className="font-mono">{a.api_key_hint}</span>
                  </p>
                  <p className="mt-1.5 text-[12.5px] leading-[1.5] text-text">
                    {REASON_COPY[a.error_reason ?? ''] ??
                      a.error_message ??
                      'The exchange refused these credentials.'}
                  </p>
                </div>

                <div className="flex flex-none flex-col items-end gap-1.5">
                  <span className={`text-[12px] font-bold ${DEADLINE_TONE(a.days_left)}`}>
                    {a.days_left === null
                      ? '—'
                      : a.days_left <= 0
                        ? 'Disconnects today'
                        : `${a.days_left} day${a.days_left === 1 ? '' : 's'} left`}
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-[12px] font-bold text-text transition-[border-color] duration-150 hover:border-accent disabled:cursor-not-allowed disabled:opacity-55"
                    onClick={() => recheck(a.id)}
                    disabled={busyId !== null}
                  >
                    {busyId === a.id ? (
                      <Loader2
                        size={13}
                        className="animate-[dstate-spin_0.8s_linear_infinite]"
                      />
                    ) : (
                      <RefreshCw size={13} />
                    )}
                    {busyId === a.id ? 'Testing…' : 'Recheck'}
                  </button>
                </div>
              </div>

              <p className="mt-2.5 border-t border-hair pt-2 text-[11px] text-faint">
                Blocked {a.blocked_at ? fmtMediumDate(a.blocked_at) : '—'}
                {a.checked_at && ` · last checked ${fmtMediumDate(a.checked_at)}`}
                {a.grace_ends_at &&
                  ` · auto-disconnect ${fmtMediumDate(a.grace_ends_at)}`}
              </p>

              {note?.id === a.id && (
                <p className="mt-2 text-[12px] font-semibold text-accent">
                  {note.text}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
