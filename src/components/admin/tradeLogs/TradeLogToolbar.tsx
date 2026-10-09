import { Search, X } from 'lucide-react'
import { CHIP_BASE, CHIP_OFF, CHIP_ON, ROW_LABEL, SELECT } from './tradeLogClasses'
import type { OutcomeFilter, TradeLogFilterState } from '../../../hooks/useTradeLogFilters'
import type { ReasonCount } from '../../../types/tradeLogs'

const ACTIONS = ['all', 'BUY', 'SELL', 'EXIT_LONG', 'EXIT_SHORT'] as const

const OUTCOMES: { key: OutcomeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'filled', label: 'Filled' },
  { key: 'skipped', label: 'Skipped' },
  { key: 'failed', label: 'Failed' },
  { key: 'problem', label: 'Problems only' },
]

/** Reason keys in the API are snake_case; this is only a fallback label. */
function humanizeKey(key: string): string {
  const s = key.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * The Signal Log's filters. The Signals view gets every one; the Issues view
 * only the SIGNAL filters (action, ticker, dates), since issues are grouped
 * across every account — the account filters would have nothing to narrow.
 *
 * Lives OUTSIDE the re-keyed list region: that key remounts its subtree on
 * every filter change, and an input inside it would lose focus per keystroke.
 */
export default function TradeLogToolbar({
  view,
  filters: f,
  tickers,
  reasons,
}: {
  view: 'signals' | 'issues'
  filters: TradeLogFilterState
  tickers: string[]
  reasons: ReasonCount[]
}) {
  const signals = view === 'signals'
  const showClear = signals ? f.signalFiltersActive || f.accountFiltersActive : f.signalFiltersActive

  const problemReasons = reasons.filter((r) => r.severity === 'problem')
  const normalReasons = reasons.filter((r) => r.severity !== 'problem')
  // A reason chosen earlier may hold no outcome under the current window;
  // keep it in the list so the select still shows what is applied.
  const reasonMissing = f.reason !== 'all' && !reasons.some((r) => r.key === f.reason)
  // Same for a ticker: the select must never silently display another value.
  const tickerOptions =
    f.ticker !== 'all' && !tickers.includes(f.ticker) ? [f.ticker, ...tickers] : tickers

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Signal action">
        {ACTIONS.map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={f.action === a}
            className={`${CHIP_BASE} ${f.action === a ? CHIP_ON : CHIP_OFF}`}
            onClick={() => f.setAction(a)}
          >
            {a === 'all' ? 'All actions' : a.replace('_', ' ')}
          </button>
        ))}
      </div>

      {signals && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Account outcome">
          <span className={ROW_LABEL}>Accounts</span>
          {OUTCOMES.map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={f.outcome === o.key}
              className={`${CHIP_BASE} ${f.outcome === o.key ? CHIP_ON : CHIP_OFF}`}
              onClick={() => f.setOutcome(o.key)}
            >
              {o.key === 'problem' && f.outcome !== o.key && (
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red align-middle" />
              )}
              {o.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <select
          className={`${SELECT} max-[520px]:w-full`}
          value={f.ticker}
          onChange={(e) => f.setTicker(e.target.value)}
          aria-label="Filter by ticker"
        >
          <option value="all">All tickers</option>
          {tickerOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {signals && (
          <select
            className={`${SELECT} max-w-[300px] max-[520px]:w-full max-[520px]:max-w-full`}
            value={f.reason}
            onChange={(e) => f.setReason(e.target.value)}
            aria-label="Filter by reason"
          >
            <option value="all">All reasons</option>
            {reasonMissing && <option value={f.reason}>{humanizeKey(f.reason)} (0)</option>}
            {problemReasons.length > 0 && (
              <optgroup label="Problems">
                {problemReasons.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label} ({r.count})
                  </option>
                ))}
              </optgroup>
            )}
            {normalReasons.length > 0 && (
              <optgroup label="Normal">
                {normalReasons.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label} ({r.count})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        )}

        {signals && (
          <label className="flex h-[38px] min-w-[200px] flex-1 items-center gap-2 rounded-[12px] border border-border bg-surface2 px-3 text-muted max-[520px]:w-full max-[520px]:min-w-0 sm:max-w-[280px]">
            <Search size={14} aria-hidden="true" className="flex-none" />
            <input
              type="text"
              inputMode="search"
              placeholder="Customer or account…"
              value={f.accountInput}
              onChange={(e) => f.setAccountInput(e.target.value)}
              aria-label="Search by customer or account"
              className="min-w-0 flex-1 border-0 bg-transparent text-[12.5px] text-text outline-none placeholder:text-faint"
            />
            {f.accountInput && (
              <button
                type="button"
                onClick={() => f.setAccountInput('')}
                aria-label="Clear the customer search"
                className="grid h-6 w-6 flex-none place-items-center rounded-full text-faint hover:bg-surface hover:text-text"
              >
                <X size={13} />
              </button>
            )}
          </label>
        )}

        <label className="flex items-center gap-2 text-[12px] text-faint max-[520px]:flex-1">
          From
          <input
            type="date"
            value={f.from}
            onChange={(e) => f.setFrom(e.target.value)}
            className={`${SELECT} max-[520px]:flex-1`}
          />
        </label>
        <label className="flex items-center gap-2 text-[12px] text-faint max-[520px]:flex-1">
          To
          <input
            type="date"
            value={f.to}
            onChange={(e) => f.setTo(e.target.value)}
            className={`${SELECT} max-[520px]:flex-1`}
          />
        </label>

        {showClear && (
          <button
            type="button"
            onClick={f.clear}
            className="inline-flex items-center gap-1 px-1 py-1.5 text-[12.5px] font-semibold text-accent hover:underline"
          >
            <X size={13} aria-hidden="true" />
            Clear filters
          </button>
        )}
      </div>

      {!signals && f.accountFiltersActive && (
        <p className="text-[12px] leading-[1.5] text-faint">
          The Accounts, Reason and Customer filters only apply to the Signals view — issues are
          grouped across every account.
        </p>
      )}
    </div>
  )
}
