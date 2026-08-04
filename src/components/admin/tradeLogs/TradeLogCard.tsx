import { ChevronDown, ChevronRight } from 'lucide-react'
import ExchangeBadge from '../../billing/ExchangeBadge'
import SizingBreakdown from './SizingBreakdown'
import { fmtDateTime, fmtMoney, fmtQty } from '../../../lib/format'
import type { FanoutStatus, TradeLogDetail, TradeLogRow } from '../../../types/tradeLogs'

const ACTION_PILL: Record<TradeLogRow['action'], string> = {
  BUY: 'bg-[color-mix(in_srgb,var(--green)_16%,transparent)] text-green',
  SELL: 'bg-[color-mix(in_srgb,var(--red)_16%,transparent)] text-red',
  EXIT_LONG: 'bg-surface2 text-muted',
  EXIT_SHORT: 'bg-surface2 text-muted',
}

const STATUS_PILL: Record<FanoutStatus, string> = {
  filled: 'bg-[color-mix(in_srgb,var(--green)_16%,transparent)] text-green',
  skipped: 'bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-accent',
  failed: 'bg-[color-mix(in_srgb,var(--red)_16%,transparent)] text-red',
}

const META = 'text-[11.5px] text-faint'
const COUNT_CHIP =
  'font-mono text-[11.5px] px-2 py-[2px] rounded-pill border border-hair'

export default function TradeLogCard({
  log,
  expanded,
  onToggle,
}: {
  log: TradeLogRow
  expanded: boolean
  onToggle: () => void
}) {
  const isEntry = log.action === 'BUY' || log.action === 'SELL'
  const rejected = log.category === 'rejected'

  return (
    <article className="rounded-card border border-border bg-surface overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 p-card text-left cursor-pointer bg-transparent border-none hover:bg-surface2 transition-colors duration-150"
      >
        <span className="text-faint flex-shrink-0">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={`text-[10px] font-bold uppercase tracking-[0.05em] py-[3px] px-[9px] rounded-pill ${ACTION_PILL[log.action]}`}
            >
              {log.action.replace('_', ' ')}
            </span>
            <span className="font-mono text-[13.5px] font-semibold text-text">
              {log.ticker}
            </span>
            <ExchangeBadge exchange={log.exchange} />
            {log.category && log.category !== 'signal' && (
              <span className="text-[10px] uppercase tracking-[0.05em] text-faint font-semibold px-2 py-[2px] rounded-pill border border-hair">
                {log.category}
              </span>
            )}
          </div>
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
            <span className={META}>{log.ts ? fmtDateTime(log.ts) : '—'}</span>
            {log.price !== null && (
              <span className={`${META} font-mono`}>@ {fmtMoney(log.price)}</span>
            )}
            {log.leverage !== null && (
              <span className={`${META} font-mono`}>{log.leverage}×</span>
            )}
            {log.strategy && <span className={META}>{log.strategy}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
          <span className={`${COUNT_CHIP} text-green`}>{log.filled} filled</span>
          {log.skipped > 0 && (
            <span className={`${COUNT_CHIP} text-accent`}>{log.skipped} skipped</span>
          )}
          {log.failed > 0 && (
            <span className={`${COUNT_CHIP} text-red`}>{log.failed} failed</span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-card pb-card pt-0 animate-[fadeup_0.25s_ease-out]">
          <div className="border-t border-hair pt-3.5 flex flex-col gap-2.5">
            {rejected ? (
              <p className="text-[13px] text-muted">
                Signal rejected before any account was touched
                {log.details[0]?.reason ? ` — ${log.details[0].reason}` : ''}.
              </p>
            ) : log.details.length === 0 ? (
              <p className="text-[13px] text-muted">No per-account detail recorded.</p>
            ) : (
              log.details.map((detail, i) => (
                <AccountRow
                  key={`${detail.uniId ?? 'x'}-${detail.account ?? i}`}
                  detail={detail}
                  ticker={log.ticker}
                  isEntry={isEntry}
                />
              ))
            )}
          </div>
        </div>
      )}
    </article>
  )
}

function AccountRow({
  detail,
  ticker,
  isEntry,
}: {
  detail: TradeLogDetail
  ticker: string
  isEntry: boolean
}) {
  const status = detail.status ?? 'failed'

  return (
    <div className="rounded-[12px] border border-hair bg-surface p-3">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-text">
            {detail.account ?? 'Unknown account'}
          </p>
          {detail.userName && (
            <p className="text-[11.5px] text-faint">{detail.userName}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {!isEntry && detail.closedQuantity !== null && (
            <span className="font-mono text-[12px] text-muted">
              closed {fmtQty(detail.closedQuantity, 0, 8)}
            </span>
          )}
          {detail.fillPrice !== null && (
            <span className="font-mono text-[12px] text-muted">
              @ {fmtMoney(detail.fillPrice)}
            </span>
          )}
          <span
            className={`text-[10px] font-bold uppercase tracking-[0.05em] py-[3px] px-[9px] rounded-pill ${STATUS_PILL[status]}`}
          >
            {status}
          </span>
        </div>
      </div>

      {(detail.reason || detail.error) && (
        <p className="text-[12px] text-muted mb-2 leading-snug">
          {detail.reason ?? detail.error}
          {detail.retryable ? ' (retryable)' : ''}
        </p>
      )}

      {detail.sizing ? (
        <SizingBreakdown sizing={detail.sizing} ticker={ticker} />
      ) : isEntry ? (
        <p className="text-[11.5px] text-faint">
          No sizing recorded — this signal predates sizing telemetry.
        </p>
      ) : null}
    </div>
  )
}
