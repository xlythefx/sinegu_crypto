import type { ReactNode } from 'react'
import { AlertTriangle, ChevronDown, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { CheckRow } from './BinanceSizingCheck'
import { fmtMoney, fmtQty } from '../../../lib/format'
import type { CheckStatus } from '../../../lib/binanceSizingCheck'
import type { PositionLimitState } from '../../../hooks/usePositionLimit'
import type { PositionLimitAccount } from '../../../types/admin'

/**
 * The asset form's "Binance position limit": at the coin's leverage Binance
 * accepts only so big a position (SANTOS at 10× = $10,000), and every entry
 * past it is refused (-2027). Sizes grow with each account's balance, so this
 * checks the PROPOSED size against EVERY real-money account, names any that
 * would go over, and says the balance at which an account would — so a size
 * stays safe as customers deposit more. Worked out by the engine with its own
 * sizing (usePositionLimit → POST /admin/assets/position-limit).
 */

interface Props {
  coin: string
  limit: PositionLimitState
}

/** Above this share of the limit a full stack is one price rise from refusals. */
const LIMIT_TIGHT_PCT = 85
/** Below this many times the biggest balance, "safe up to" leaves little room for deposits. */
const DEPOSIT_ROOM = 1.25

const usd = (v: number) => fmtMoney(v, Math.abs(v) >= 1000 ? 0 : 2)
const bal = (v: number) => `${fmtQty(v, 0, 0)} USDT`

function accountStatus(a: PositionLimitAccount): CheckStatus {
  if (a.over) return 'bad'
  return a.used_pct !== null && a.used_pct > LIMIT_TIGHT_PCT ? 'warn' : 'ok'
}

const STATUS_TEXT: Record<CheckStatus, string> = { ok: 'text-green', warn: 'text-accent', bad: 'text-red' }

function AccountList({ accounts, coin }: { accounts: PositionLimitAccount[]; coin: string }) {
  return (
    <details className="group rounded-row border border-hair">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[12px] font-semibold text-muted hover:text-text">
        Every account ({accounts.length})
        <ChevronDown size={14} className="transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <ul className="divide-y divide-hair border-t border-hair">
        {accounts.map((a, i) => {
          const status = accountStatus(a)
          return (
            <li key={`${a.name}-${i}`} className="flex items-start justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-text">
                  {a.name ?? '—'}
                  {a.is_master && <span className="ml-1.5 text-[10.5px] font-bold text-accent">MASTER</span>}
                </p>
                <p className="font-mono text-[11px] text-faint">
                  {bal(a.balance)} · {fmtQty(a.full_qty, 0, 4)} {coin}
                </p>
              </div>
              <div className="flex-none text-right">
                <p className="font-mono text-[12px] font-semibold text-text">{a.full_usd !== null ? usd(a.full_usd) : '—'}</p>
                {a.used_pct !== null && (
                  <p className={`font-mono text-[11px] font-semibold ${STATUS_TEXT[status]}`}>{a.used_pct.toFixed(0)}% of limit</p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </details>
  )
}

export default function PositionLimitCheck({ coin, limit }: Props) {
  const { data, loading, error, reload } = limit

  let body: ReactNode
  if (loading && !data) {
    body = (
      <p className="flex items-center gap-2 text-[12px] text-muted" role="status">
        <Loader2 size={13} className="animate-spin" /> Reading Binance’s limit for {coin}…
      </p>
    )
  } else if (error || !data) {
    body = (
      <p className="flex items-start gap-2 text-[12px] text-red" role="alert">
        <XCircle size={14} className="mt-px flex-none" /> {error ?? 'The limit could not be checked.'}
      </p>
    )
  } else if (data.leverage_allowed === false) {
    body = (
      <CheckRow
        status="bad"
        chip="Leverage refused"
        label={`Leverage ${data.leverage}×`}
        value={`Binance allows at most ${data.max_leverage}× on ${coin}`}
        note={`Every entry would be refused at ${data.leverage}×, whatever the size. Set Leverage under Sizing to ${data.max_leverage} or lower.${
          data.leverage_assumed ? ' (No leverage is set on this coin, so the signals’ default was assumed.)' : ''
        }`}
      />
    )
  } else if (data.cap_usd === null) {
    body = <p className="text-[12px] text-faint">Binance did not say how big a position it accepts on {coin}.</p>
  } else {
    const biggest = data.accounts[0] ?? null
    const over = data.accounts.filter((a) => a.over)
    const biggestStatus = biggest ? accountStatus(biggest) : 'ok'
    const safe = data.safe_balance
    const safeStatus: CheckStatus =
      safe === null || !biggest
        ? 'ok'
        : over.length > 0
          ? 'bad'
          : safe < biggest.balance * DEPOSIT_ROOM
            ? 'warn'
            : 'ok'
    const next = data.brackets
      .filter((b) => b.leverage < (data.leverage ?? 0))
      .sort((a, b) => b.leverage - a.leverage)[0]

    body = (
      <div className="flex flex-col gap-3">
        <div className="divide-y divide-hair">
          <CheckRow
            status="info"
            label={`Most Binance accepts at ${data.leverage}×`}
            value={usd(data.cap_usd)}
            note={
              <>
                {`One position on ${coin}, per account. Above it the later entries are refused.`}
                {next && ` At ${next.leverage}× the limit is ${usd(next.cap_usd)}.`}
                {data.leverage_assumed && ' No leverage is set on this coin, so the signals’ default was assumed.'}
              </>
            }
          />

          {biggest && (
            <CheckRow
              status={biggestStatus}
              chip={biggestStatus === 'ok' ? 'Fits' : biggestStatus === 'warn' ? 'Tight' : 'Over the limit'}
              label={`Biggest account · ${data.entries || 1} ${data.entries === 1 ? 'entry' : 'entries'}`}
              value={`${biggest.name ?? '—'} · ${biggest.full_usd !== null ? usd(biggest.full_usd) : '—'}`}
              note={
                biggest.used_pct !== null
                  ? `${bal(biggest.balance)} balance, full position ${biggest.used_pct.toFixed(0)}% of the limit.${
                      data.price_headroom_pct !== null && data.price_headroom_pct > 0
                        ? ` ${coin} can rise ${data.price_headroom_pct.toFixed(0)}% before it reaches it.`
                        : ''
                    }`
                  : undefined
              }
            />
          )}

          {over.length > 0 && (
            <CheckRow
              status="bad"
              chip={`${over.length} over`}
              label={`Accounts over the limit (${over.length} of ${data.accounts.length})`}
              value={over.map((a) => a.name ?? '—').join(', ')}
              note="Their full position is bigger than Binance accepts, so their later entries would be refused. Lower the base or max size, or the leverage."
            />
          )}

          {safe !== null && (
            <CheckRow
              status={safeStatus}
              chip={safeStatus === 'ok' ? 'Room to grow' : safeStatus === 'warn' ? 'Little room' : undefined}
              label="Safe up to a balance of"
              value={safe > 0 ? bal(safe) : 'No balance — even the smallest account is over'}
              note={
                safe > 0
                  ? `An account above this would go over the limit at today’s price. Sizes grow with balances, so this is the figure to watch as customers deposit.`
                  : undefined
              }
            />
          )}
        </div>

        {data.accounts.length > 1 && <AccountList accounts={data.accounts} coin={coin} />}

        <p className="text-[11px] leading-[1.5] text-faint">
          {data.mark_price ? `At a mark price of ${usd(data.mark_price)}. ` : ''}
          Real-money accounts only. Binance can lower a coin’s limits at any time; check again before saving.
          {loading && ' Updating…'}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[12px] border border-border">
      <div className="flex items-center justify-between gap-2 border-b border-hair px-3.5 py-2.5">
        <span className="flex items-center gap-1.5 text-[13.5px] font-semibold">
          {data && data.over_count > 0 && <AlertTriangle size={14} className="text-red" aria-hidden="true" />}
          Binance position limit
        </span>
        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded-pill text-muted hover:text-text disabled:opacity-50"
          aria-label="Check the limit again"
          onClick={reload}
          disabled={loading}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="p-3.5">{body}</div>
    </div>
  )
}
