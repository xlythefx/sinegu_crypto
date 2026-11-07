import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, Lightbulb, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { fmtMoney, fmtQty } from '../../../lib/format'
import {
  FALLBACK_SIGNAL_LEVERAGE,
  FULL_STACK_MARGIN_BUDGET,
  checkSizing,
  type CheckStatus,
} from '../../../lib/binanceSizingCheck'
import type { BinanceSizingCheckState } from '../../../hooks/useBinanceSizingCheck'

/**
 * The asset form's Binance check: Binance's minimum order, the base size and the
 * full position in dollars, and how much of the smallest trading account's balance
 * the full position ties up as margin — with a smaller base size suggested when it
 * is too much. The rules come from the API once per ticker (useBinanceSizingCheck);
 * the numbers re-run on every keystroke (lib/binanceSizingCheck).
 */

interface Props {
  ticker: string
  baseSize: number
  maxPosition: number
  check: BinanceSizingCheckState
  onUseBase: (base: number) => void
}

const usd = (v: number) => fmtMoney(v, Math.abs(v) >= 1000 ? 0 : 2)
const qty = (v: number) => fmtQty(v, 0, 6)
const pct = (v: number) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`
const times = (v: number) => `${v.toFixed(v < 10 ? 1 : 0)}×`

const ICON: Record<CheckStatus | 'info', ReactNode> = {
  ok: <CheckCircle2 size={15} className="text-green" aria-hidden="true" />,
  warn: <AlertTriangle size={15} className="text-accent" aria-hidden="true" />,
  bad: <XCircle size={15} className="text-red" aria-hidden="true" />,
  info: <Info size={15} className="text-faint" aria-hidden="true" />,
}
const CHIP: Record<CheckStatus, string> = {
  ok: 'bg-green/15 text-green',
  warn: 'bg-accent-soft text-accent',
  bad: 'bg-red/10 text-red',
}

function Row({
  status,
  chip,
  label,
  value,
  note,
}: {
  status: CheckStatus | 'info'
  chip?: string
  label: string
  value: ReactNode
  note?: ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
      <span className="mt-0.5 flex-none">{ICON[status]}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="text-[11.5px] font-semibold text-muted">{label}</span>
          {chip && status !== 'info' && (
            <span className={`rounded-pill px-2 py-0.5 text-[10.5px] font-bold ${CHIP[status]}`}>{chip}</span>
          )}
        </div>
        <p className="mt-0.5 break-words font-mono text-[12.5px] font-semibold text-text">{value}</p>
        {note && <p className="mt-0.5 text-[11.5px] leading-[1.5] text-faint">{note}</p>}
      </div>
    </div>
  )
}

function Suggestion({ tone, children, action }: { tone: 'warn' | 'bad'; children: ReactNode; action?: ReactNode }) {
  const box = tone === 'bad' ? 'border-red/40 bg-red/10' : 'border-accent-line bg-accent-soft'
  return (
    <div className={`flex flex-col gap-2.5 rounded-row border px-3 py-2.5 sm:flex-row sm:items-center ${box}`}>
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <Lightbulb size={14} className="mt-[3px] flex-none text-accent" aria-hidden="true" />
        <p className="text-[12px] leading-[1.55] text-text">{children}</p>
      </div>
      {action}
    </div>
  )
}

const BTN =
  'inline-flex h-9 flex-none items-center justify-center gap-1.5 rounded-pill border border-border bg-surface2 px-3.5 text-[12px] font-semibold text-text hover:border-accent'

export default function BinanceSizingCheck({ ticker, baseSize, maxPosition, check, onUseBase }: Props) {
  const { data, loading, error, reload } = check
  const symbol = ticker.trim().toUpperCase()
  // Leverage is the signal's on this engine; before any signal has carried one, assume QuantLab's.
  const leverage = data?.leverage.value ?? FALLBACK_SIGNAL_LEVERAGE
  const sizing =
    data
      ? checkSizing({
          ticker: data.ticker,
          baseSize,
          maxPosition,
          leverage,
          rules: data.binance,
          smallestBalance: data.accounts.smallest_balance,
        })
      : null

  const retry = (
    <button type="button" className={BTN} onClick={reload}>
      <RefreshCw size={13} /> Retry
    </button>
  )

  let body: ReactNode
  if (symbol.length < 2) {
    body = <p className="text-[12px] text-faint">Type the ticker to check its size against Binance.</p>
  } else if (loading) {
    body = (
      <p className="flex items-center gap-2 text-[12px] text-muted" role="status">
        <Loader2 size={13} className="animate-spin" /> Checking {symbol} on Binance…
      </p>
    )
  } else if (error || !data) {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <p className="flex items-start gap-2 text-[12px] text-red" role="alert">
          <XCircle size={14} className="mt-px flex-none" /> {error ?? 'The check could not be loaded.'}
        </p>
        {retry}
      </div>
    )
  } else if (!data.binance) {
    body = (
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <p className="flex items-start gap-2 text-[12px] text-accent" role="alert">
          <AlertTriangle size={14} className="mt-px flex-none" /> {data.binance_error ?? 'Binance did not answer.'}
        </p>
        {retry}
      </div>
    )
  } else if (!data.binance.listed) {
    body = (
      <Row
        status="bad"
        chip="Not on Binance"
        label="Binance futures"
        value={data.symbol}
        note={`Binance has no USDⓈ-M futures coin called ${data.symbol}, so the engine can’t trade it. Check the spelling.`}
      />
    )
  } else {
    const rules = data.binance
    const accounts = data.accounts
    const coin = sizing?.coin ?? symbol
    const lev = leverage
    const leverageNote =
      data.leverage.source === 'coin'
        ? `this coin’s latest signal`
        : data.leverage.source === 'exchange'
          ? 'the latest Binance signal (none for this coin yet)'
          : data.leverage.source === 'any_feed'
            ? 'the latest test-feed signal'
            : 'an assumption: no signal has carried a leverage yet'
    body = (
      <div className="flex flex-col gap-3">
        {rules.status && rules.status !== 'TRADING' && (
          <p className="flex items-start gap-2 text-[12px] text-accent" role="alert">
            <AlertTriangle size={14} className="mt-px flex-none" />
            Binance lists {data.symbol} as {rules.status}, not TRADING. Orders may be refused.
          </p>
        )}
        {data.binance_error && (
          <p className="flex items-start gap-2 text-[12px] text-accent" role="alert">
            <AlertTriangle size={14} className="mt-px flex-none" /> {data.binance_error}
          </p>
        )}
        <div className="divide-y divide-hair">
          <Row
            status="info"
            label="Binance minimum order"
            value={
              sizing?.minOrder
                ? `${qty(sizing.minOrder.qty)} ${coin}${sizing.minOrder.usd !== null ? ` ≈ ${usd(sizing.minOrder.usd)}` : ''}`
                : 'Unknown'
            }
            note={rules.min_notional ? `Binance refuses any order worth less than ${usd(rules.min_notional)}.` : undefined}
          />

          {sizing ? (
            <Row
              status={sizing.base.status}
              chip={sizing.base.status === 'ok' ? 'OK' : sizing.base.status === 'warn' ? 'Close to minimum' : 'Too small'}
              label="Base size (one entry)"
              value={`${qty(sizing.base.qty)} ${coin}${sizing.base.usd !== null ? ` ≈ ${usd(sizing.base.usd)}` : ''}`}
              note={
                <>
                  {sizing.base.timesMinimum === null
                    ? null
                    : sizing.base.status === 'bad'
                      ? 'Under Binance’s minimum: every entry would be refused.'
                      : sizing.base.status === 'warn'
                        ? `Only ${times(sizing.base.timesMinimum)} the minimum; a price drop could push it under.`
                        : `${times(sizing.base.timesMinimum)} Binance’s minimum.`}
                  {sizing.base.sentAs !== null &&
                    ` Binance trades ${coin} in steps of ${rules.step_size}, so the engine sends ${qty(sizing.base.sentAs)}.`}
                </>
              }
            />
          ) : (
            <Row status="info" label="Base size (one entry)" value={baseSize > 0 ? `${qty(baseSize)} ${coin}` : 'Set a base size'} />
          )}

          {sizing?.stack && (
            <Row
              status="info"
              label={`Full position (${sizing.stack.entries} ${sizing.stack.entries === 1 ? 'entry' : 'entries'})`}
              value={`${qty(sizing.stack.fullQty)} ${coin} ≈ ${usd(sizing.stack.fullUsd)}`}
              note={`Needs about ${usd(sizing.stack.margin)} of margin at ${lev}×${
                ` (from ${leverageNote})`
              } on the smallest account.`}
            />
          )}

          {accounts.count === 0 || accounts.smallest_balance === null ? (
            <Row
              status="info"
              label="Smallest trading account"
              value="None yet"
              note={`No account has passed the ${fmtQty(data.min_deposit, 0, 0)} USDT deposit minimum with a working key, so there is nothing to compare against.`}
            />
          ) : (
            <Row
              status={sizing?.stack?.status ?? 'info'}
              chip={
                !sizing?.stack
                  ? undefined
                  : sizing.stack.status === 'ok'
                    ? 'Fits'
                    : sizing.stack.status === 'warn'
                      ? 'Tight'
                      : 'Can’t hold it'
              }
              label={`Smallest trading account (of ${accounts.count})`}
              value={`${accounts.smallest_name ?? '—'} · ${fmtQty(accounts.smallest_balance, 0, 2)} USDT`}
              note={
                <>
                  {sizing?.stack
                    ? sizing.stack.status === 'bad'
                      ? `The full position needs ${pct(sizing.stack.share)} of its balance as margin, more than it has. The later entries would be refused.`
                      : `The full position uses ${pct(sizing.stack.share)} of its balance as margin (limit ${pct(FULL_STACK_MARGIN_BUDGET)}).`
                    : !rules.price
                      ? 'No price from Binance, so the margin can’t be worked out.'
                      : null}
                  {accounts.demo_only && ' No live account qualifies, so these are demo accounts.'}
                </>
              }
            />
          )}
        </div>

        {sizing?.base.raiseTo && sizing.base.raiseTo > sizing.base.qty && (
          <Suggestion
            tone={sizing.base.status === 'bad' ? 'bad' : 'warn'}
            action={
              <button type="button" className={BTN} onClick={() => onUseBase(sizing.base.raiseTo!)}>
                Use {qty(sizing.base.raiseTo)}
              </button>
            }
          >
            Raise the base size to at least{' '}
            <b>
              {qty(sizing.base.raiseTo)} {coin}
            </b>
            {sizing.price ? ` (≈ ${usd(sizing.base.raiseTo * sizing.price)})` : ''}, so a price drop can’t take it under
            Binance’s minimum.
          </Suggestion>
        )}

        {sizing?.suggestedBase && sizing.stack && (
          <Suggestion
            tone={sizing.stack.status === 'bad' ? 'bad' : 'warn'}
            action={
              <button type="button" className={BTN} onClick={() => onUseBase(sizing.suggestedBase!)}>
                Use {qty(sizing.suggestedBase)}
              </button>
            }
          >
            Suggested base size:{' '}
            <b>
              {qty(sizing.suggestedBase)} {coin}
            </b>
            {sizing.price ? ` (≈ ${usd(sizing.suggestedBase * sizing.price)})` : ''}. The full position would then use
            about {pct((sizing.stack.share * sizing.suggestedBase) / sizing.base.qty)} of the smallest account.
          </Suggestion>
        )}

        {sizing?.minimumTooBig && sizing.stack && sizing.shareAtMinimum !== null && (
          <Suggestion tone="bad">
            Even Binance’s minimum order would use {pct(sizing.shareAtMinimum)} of the smallest account across{' '}
            {sizing.stack.entries} entries. Pick a lower multiple, or accept that small accounts carry a large share.
          </Suggestion>
        )}

        <p className="text-[11px] leading-[1.5] text-faint">
          {rules.price ? `Mark price ${usd(rules.price)}, checked ${new Date(data.checked_at).toLocaleTimeString()}. ` : ''}
          Prices move, so check again before saving. If Binance caps {coin} below {lev}×, the account
          gets the lower leverage and more margin is needed.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[12px] border border-border">
      <div className="flex items-center justify-between gap-2 border-b border-hair px-3.5 py-2.5">
        <span className="text-[13.5px] font-semibold">Binance check</span>
        {data && (
          <div className="flex items-center gap-1.5">
            <span className="rounded-pill border border-border px-2 py-0.5 font-mono text-[10.5px] text-muted">
              {data.symbol}
            </span>
            <button
              type="button"
              className="grid h-8 w-8 place-items-center rounded-pill text-muted hover:text-text disabled:opacity-50"
              aria-label="Check again"
              onClick={reload}
              disabled={loading}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        )}
      </div>
      <div className="p-3.5">{body}</div>
    </div>
  )
}
