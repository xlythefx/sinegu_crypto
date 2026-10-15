import { useState } from 'react'
import { Check, ChevronDown, ChevronRight, RotateCw, TestTubeDiagonal } from 'lucide-react'
import ExchangeBadge from '../../billing/ExchangeBadge'
import { TESTER_TINT } from '../badges'
import SideTypePill from './SideTypePill'
import SizingBreakdown from './SizingBreakdown'
import {
  COUNT_CHIP,
  LABEL_CHIP,
  PILL,
  REASON_BADGE,
  SEVERITY_TONE,
  TONE,
} from './tradeLogClasses'
import { fmtDateTime, fmtMoney, fmtQty, fmtSignedMoney } from '../../../lib/format'
import {
  masterBadge,
  masterDetailOf,
  plural,
  severityOf,
  sortDetails,
} from '../../../lib/signalHealth'
import type { TradeLogDetail, TradeLogRetry, TradeLogRow } from '../../../types/tradeLogs'

const META = 'text-[11.5px] text-faint'

/** Average executed price over the accounts that filled; null when none reported one. */
function avgFill(details: TradeLogDetail[]): number | null {
  const prices = details.filter((d) => d.status === 'filled' && d.fillPrice !== null).map((d) => d.fillPrice as number)
  return prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null
}

/** The main account's closed trade on an exit (its own run, or a retry that closed it). */
function mainClose(log: TradeLogRow): TradeLogDetail | null {
  const runs = [log.details, ...log.retries.map((r) => r.details)]
  for (const details of runs) {
    const d = details.find((x) => x.isMaster && x.close?.realizedPnl != null)
    if (d) return d
  }
  return null
}

function retryTone(r: TradeLogRetry): string {
  if (r.failed > 0) return TONE.bad
  if (r.filled > 0) return TONE.good
  return TONE.neutral
}

/** Status pill: a skip is grey when it is a skip by design, red when it is a problem. */
function statusTone(detail: TradeLogDetail): string {
  if (detail.status === 'filled') return TONE.good
  // No status at all is printed as "failed" below, so it reads as one.
  if (detail.status === null || severityOf(detail) === 'problem') return TONE.bad
  return TONE.neutral
}

export default function TradeLogCard({
  log,
  expanded,
  onToggle,
  accountFiltersActive,
}: {
  log: TradeLogRow
  expanded: boolean
  onToggle: () => void
  /** Account filters are on: show the accounts they matched, the rest on request. */
  accountFiltersActive: boolean
}) {
  const [showAll, setShowAll] = useState(false)
  const isEntry = log.type === 'entry'
  const fill = isEntry ? avgFill(log.details) : null
  const main = isEntry ? null : mainClose(log)
  const lastRetry = log.retries[log.retries.length - 1] ?? null
  const rejected = log.category === 'rejected'
  const rejectReason = log.details[0]?.reason ?? log.details[0]?.error ?? null
  // The test feed reaches testers only — the master is never in it, so a
  // "No master" chip there would be noise.
  const master = rejected || log.feed === 'test' ? null : masterBadge(log.master, masterDetailOf(log))

  const sorted = sortDetails(log.details)
  const matching = accountFiltersActive ? sorted.filter((d) => d.match) : sorted
  const narrowed = matching.length < sorted.length
  const shown = narrowed && !showAll ? matching : sorted

  return (
    <article
      className={`rounded-card border bg-surface overflow-hidden ${
        log.problems > 0 || rejected
          ? 'border-[color-mix(in_srgb,var(--red)_28%,var(--border))]'
          : 'border-border'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 border-none bg-transparent p-card text-left transition-colors duration-150 hover:bg-surface2 max-[480px]:p-3.5 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
      >
        <span className="text-faint flex-shrink-0 self-start pt-[3px] sm:self-center sm:pt-0">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <SideTypePill side={log.side} type={log.type} />
            <span className="font-mono text-[13.5px] font-semibold text-text">{log.ticker}</span>
            <ExchangeBadge exchange={log.exchange} />
            {log.feed === 'test' && (
              <span
                className={`${LABEL_CHIP} ${TESTER_TINT} whitespace-nowrap`}
                title="Came in on the engine's test webhook: tester accounts only, never posted to Telegram or Discord"
              >
                <TestTubeDiagonal size={11} aria-hidden="true" />
                Test feed
              </span>
            )}
            {log.category && log.category !== 'signal' && !rejected && (
              <span className="text-[10px] uppercase tracking-[0.05em] text-faint font-semibold px-2 py-[2px] rounded-pill border border-hair">
                {log.category}
              </span>
            )}
          </div>
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
            <span className={META}>{log.ts ? fmtDateTime(log.ts) : '—'}</span>
            {log.price !== null && (
              <span className={`${META} font-mono`} title="The price TradingView sent">
                signal @ {fmtMoney(log.price, 4)}
              </span>
            )}
            {fill !== null && (
              <span className={`${META} font-mono`} title="Average price the accounts actually filled at">
                filled @ {fmtMoney(fill, 4)}
              </span>
            )}
            {log.leverage !== null && (
              <span className={`${META} font-mono`}>{log.leverage}×</span>
            )}
            {log.strategy && <span className={META}>{log.strategy}</span>}
          </div>
        </div>

        <div className="col-start-2 flex flex-wrap items-center gap-1.5 sm:col-start-3 sm:max-w-[340px] sm:justify-end">
          {rejected ? (
            <span className={`${LABEL_CHIP} ${TONE.bad} break-words`}>
              Rejected{rejectReason ? `: ${rejectReason}` : ''}
            </span>
          ) : (
            <>
              <span className={`${COUNT_CHIP} border-hair text-green`}>{log.filled} filled</span>
              {log.normalSkips > 0 && (
                <span className={`${COUNT_CHIP} ${TONE.neutral}`}>
                  {plural(log.normalSkips, 'normal skip', 'normal skips')}
                </span>
              )}
              {log.problems > 0 && (
                <span className={`${COUNT_CHIP} ${TONE.bad} font-semibold`}>
                  {plural(log.problems, 'problem', 'problems')}
                </span>
              )}
              {lastRetry && (
                <span
                  className={`${COUNT_CHIP} ${retryTone(lastRetry)}`}
                  title="The engine re-ran this signal for the accounts that failed it — the re-runs are listed when you open the row."
                >
                  <RotateCw size={11} aria-hidden="true" />
                  retried {log.retries.length}×
                </span>
              )}
              {main?.close?.realizedPnl != null && (
                <span
                  className={`${COUNT_CHIP} border-hair font-semibold ${main.close.realizedPnl >= 0 ? 'text-green' : 'text-red'}`}
                  title="The main account's result on this close, after fees"
                >
                  main {fmtSignedMoney(main.close.realizedPnl)}
                </span>
              )}
            </>
          )}
          {master && (
            <span
              className={`${LABEL_CHIP} ${TONE[master.tone]} whitespace-nowrap`}
              title={master.title}
            >
              {master.label}
              {log.master === 'filled' && <Check size={12} strokeWidth={3} aria-hidden="true" />}
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-card pb-card pt-0 animate-[fadeup_0.25s_ease-out] max-[480px]:px-3.5 max-[480px]:pb-3.5">
          <div className="border-t border-hair pt-3.5 flex flex-col gap-2.5">
            {rejected ? (
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <span className={`${REASON_BADGE} ${SEVERITY_TONE.problem}`}>
                  {log.details[0]?.reasonLabel ?? 'Signal rejected'}
                </span>
                <span className="text-[12.5px] text-muted leading-snug">
                  No account was touched{rejectReason ? ` — ${rejectReason}` : ''}.
                </span>
              </div>
            ) : log.details.length === 0 ? (
              <p className="text-[13px] text-muted">No per-account detail recorded.</p>
            ) : (
              <>
                {narrowed && (
                  <p className="text-[12px] text-faint">
                    Showing {showAll ? 'all' : plural(matching.length, 'matching account', 'matching accounts')}{' '}
                    of {plural(sorted.length, 'account', 'accounts')} on this signal.
                  </p>
                )}
                {shown.map((detail, i) => (
                  <AccountRow
                    key={`${detail.uniId ?? 'x'}-${detail.account ?? i}`}
                    detail={detail}
                    ticker={log.ticker}
                    isEntry={isEntry}
                    dimmed={narrowed && showAll && !detail.match}
                  />
                ))}
                {narrowed && (
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="self-start rounded-btn px-1 py-1 text-[12.5px] font-semibold text-accent hover:underline"
                  >
                    {showAll
                      ? 'Show only the matching accounts'
                      : `Show all ${sorted.length} accounts`}
                  </button>
                )}
              </>
            )}

            {/* Re-runs of this signal, folded here instead of listed as rows. */}
            {log.retries.length > 0 && (
              <div className="mt-1.5 flex flex-col gap-2 border-t border-hair pt-3">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-faint">
                  Retries · {log.retries.length}
                </p>
                {log.retries.map((retry, n) => (
                  <div key={retry.id} className="rounded-[12px] border border-hair bg-surface2 p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-text">
                        <RotateCw size={12} aria-hidden="true" />
                        Retry {n + 1}
                      </span>
                      <span className={META}>{retry.ts ? fmtDateTime(retry.ts) : '—'}</span>
                      <span className={`${COUNT_CHIP} ${retryTone(retry)}`}>
                        {retry.filled} filled · {retry.failed} failed
                        {retry.skipped ? ` · ${retry.skipped} skipped` : ''}
                      </span>
                    </div>
                    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                      {sortDetails(retry.details).map((detail, i) => (
                        <RetryLine key={`${detail.uniId ?? 'x'}-${detail.account ?? i}`} detail={detail} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  )
}

/** One account in a retry, on one line: who, the outcome, and why or what it made. */
function RetryLine({ detail }: { detail: TradeLogDetail }) {
  const status = detail.status ?? 'failed'
  const why = detail.reasonLabel ?? detail.reason ?? detail.error
  const pnl = detail.close?.realizedPnl ?? null
  return (
    <li className="flex list-none flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px]">
      <span className="font-semibold text-text">{detail.account ?? 'Unknown account'}</span>
      <span className={`${PILL} border ${statusTone(detail)}`}>{status}</span>
      {pnl !== null ? (
        <span className={`font-mono font-semibold ${pnl >= 0 ? 'text-green' : 'text-red'}`}>{fmtSignedMoney(pnl)}</span>
      ) : (
        why && <span className="min-w-0 break-words font-mono text-[11.5px] text-faint">{why}</span>
      )}
    </li>
  )
}

function AccountRow({
  detail,
  ticker,
  isEntry,
  dimmed,
}: {
  detail: TradeLogDetail
  ticker: string
  isEntry: boolean
  dimmed: boolean
}) {
  const status = detail.status ?? 'failed'
  const severity = severityOf(detail)
  const raw = detail.reason ?? detail.error
  const problem = severity === 'problem'

  return (
    <div
      className={`rounded-[12px] border bg-surface p-3 transition-opacity ${
        problem ? 'border-[color-mix(in_srgb,var(--red)_30%,transparent)]' : 'border-hair'
      } ${dimmed ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-x-3 gap-y-2 flex-wrap mb-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-text">
            <span className="min-w-0 break-words">{detail.account ?? 'Unknown account'}</span>
            {detail.isMaster && (
              <span className="rounded-pill border border-accent-line bg-accent-soft px-2 py-[1px] text-[10px] font-bold uppercase tracking-[0.05em] text-accent">
                Master
              </span>
            )}
          </p>
          {detail.userName && <p className="text-[11.5px] text-faint">{detail.userName}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {isEntry && detail.status === 'filled' && detail.quantity !== null && (
            <span className="font-mono text-[12px] text-muted">{fmtQty(detail.quantity, 0, 8)}</span>
          )}
          {!isEntry && detail.closedQuantity !== null && (
            <span className="font-mono text-[12px] text-muted">
              closed {fmtQty(detail.closedQuantity, 0, 8)}
            </span>
          )}
          {detail.fillPrice !== null && (
            <span className="font-mono text-[12px] text-muted">
              @ {fmtMoney(detail.fillPrice, 4)}
            </span>
          )}
          {detail.status === 'filled' && detail.increment !== null && (
            <span
              className="font-mono text-[12px] text-faint"
              title={isEntry ? 'Stack depth after this entry' : 'Increments this close took off'}
            >
              {isEntry ? 'stack ' : ''}
              {detail.increment}
              {detail.maxIncrements ? `/${detail.maxIncrements}` : ''}
              {isEntry ? '' : ' increments'}
            </span>
          )}
          <span className={`${PILL} border ${statusTone(detail)}`}>{status}</span>
        </div>
      </div>

      {/* Exits: the closed trade this close produced — what was paid in, what
          came out, and what it made after fees. */}
      {!isEntry && detail.status === 'filled' && (
        <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] text-muted">
          {detail.close ? (
            <>
              <span>
                In {detail.close.entryPrice !== null ? fmtMoney(detail.close.entryPrice, 4) : '—'} → Out{' '}
                {detail.close.exitPrice !== null ? fmtMoney(detail.close.exitPrice, 4) : '—'}
              </span>
              {detail.close.realizedPnl !== null && (
                <span className={`font-semibold ${detail.close.realizedPnl >= 0 ? 'text-green' : 'text-red'}`}>
                  {fmtSignedMoney(detail.close.realizedPnl)}
                </span>
              )}
              {detail.close.exchangeFee !== null && (
                <span className="text-faint">fee {fmtMoney(detail.close.exchangeFee)}</span>
              )}
            </>
          ) : (
            <span className="font-body text-faint">Closed trade not synced yet — the price and P&amp;L appear within a few minutes.</span>
          )}
        </p>
      )}

      {(detail.reasonLabel || raw) && (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 mb-2">
          {detail.reasonLabel && severity && (
            <span className={`${REASON_BADGE} ${SEVERITY_TONE[severity]}`}>
              {detail.reasonLabel}
            </span>
          )}
          {raw && (
            <span className="min-w-0 break-words font-mono text-[11.5px] leading-snug text-faint">
              {raw}
              {detail.retryable ? ' (retryable)' : ''}
            </span>
          )}
        </div>
      )}

      {detail.sizing ? (
        <SizingBreakdown sizing={detail.sizing} ticker={ticker} />
      ) : isEntry && detail.status === 'filled' ? (
        <p className="text-[11.5px] text-faint">
          No sizing recorded — this signal predates sizing telemetry.
        </p>
      ) : null}
    </div>
  )
}
