import { useState } from 'react'
import { Calendar as CalendarIcon, Filter } from 'lucide-react'

type Period = 'daily' | 'weekly' | 'monthly' | 'all'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'all', label: 'All' },
]

const TICKERS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'DOGE/USDT']

// Static cumulative-P&L curve for the prototype (viewBox 0 0 900 260).
const LINE_PATH =
  'M0,238 L45,232 L90,236 L135,224 L180,228 L225,212 L270,218 L315,198 L360,205 L405,182 L450,190 L495,164 L540,173 L585,142 L630,152 L675,118 L720,128 L765,92 L810,102 L855,64 L900,42'

const filterBtn =
  'flex items-center gap-1.5 h-[34px] px-3 rounded-field border border-border bg-surface text-text text-[12.5px] font-semibold cursor-pointer hover:border-accent-line hover:bg-accent-soft'
const pop =
  'absolute left-0 top-[calc(100%+6px)] z-30 flex min-w-[220px] flex-col gap-2.5 rounded-row border border-border bg-surface p-[14px] shadow-[0_20px_50px_rgba(0,0,0,0.25)]'
const clearBtn =
  'self-start border-0 bg-transparent py-0.5 text-[12px] font-bold text-accent cursor-pointer'

/** Filters row + cumulative master P&L chart card. */
export default function AdminPerformanceChart() {
  const [period, setPeriod] = useState<Period>('monthly')
  const [showDates, setShowDates] = useState(false)
  const [showTickers, setShowTickers] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [excluded, setExcluded] = useState<Set<string>>(new Set())

  const toggleTicker = (t: string) =>
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })

  const chartKey = `${period}-${dateFrom}-${dateTo}-${[...excluded].sort().join(',')}`

  return (
    <div
      className="flex min-w-0 grow-[2] basis-[480px] flex-col gap-3"
      data-aos="fade-up"
      data-aos-delay="150"
    >
      <div className="flex gap-2">
        <div className="relative">
          <button
            type="button"
            className={filterBtn}
            onClick={() => {
              setShowDates((v) => !v)
              setShowTickers(false)
            }}
          >
            <CalendarIcon size={14} />
            Date Range
          </button>
          {showDates && (
            <div className={pop}>
              <label className="flex flex-col gap-[5px] text-[12px] font-semibold text-muted">
                From
                <input
                  type="date"
                  className="h-9 rounded-btn border border-border bg-surface2 px-2.5 text-[12.5px] text-text outline-none"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-[5px] text-[12px] font-semibold text-muted">
                To
                <input
                  type="date"
                  className="h-9 rounded-btn border border-border bg-surface2 px-2.5 text-[12.5px] text-text outline-none"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </label>
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  className={clearBtn}
                  onClick={() => {
                    setDateFrom('')
                    setDateTo('')
                  }}
                >
                  Clear Dates
                </button>
              )}
            </div>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            className={filterBtn}
            onClick={() => {
              setShowTickers((v) => !v)
              setShowDates(false)
            }}
          >
            <Filter size={14} />
            Tickers
          </button>
          {showTickers && (
            <div className={pop}>
              {TICKERS.map((t) => (
                <label
                  className="flex cursor-pointer flex-row items-center gap-2 text-[12px] font-semibold text-text"
                  key={t}
                >
                  <input
                    type="checkbox"
                    className="accent-accent"
                    checked={!excluded.has(t)}
                    onChange={() => toggleTicker(t)}
                  />
                  {t}
                </label>
              ))}
              {excluded.size > 0 && (
                <button
                  type="button"
                  className={clearBtn}
                  onClick={() => setExcluded(new Set())}
                >
                  Include All
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <section className="rounded-card border border-border bg-surface p-card flex flex-1 flex-col">
        <div className="mb-[14px] flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-display text-[15px] font-extrabold">
              Master Cumulative P&L
            </div>
            <div className="text-[12px] text-muted mt-px">
              Platform performance from the master account
            </div>
          </div>
          <div className="flex gap-[3px] bg-surface2 border border-hair rounded-seg p-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`font-body py-[5px] px-2.5 text-[11.5px] rounded-btn border ${
                  period === p.key
                    ? 'bg-surface border-border text-text font-bold'
                    : 'border-transparent bg-transparent text-muted font-semibold'
                }`}
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div
          key={chartKey}
          className="flex flex-1 flex-col animate-[fadeup_0.35s_ease-out]"
        >
          <svg
            viewBox="0 0 900 260"
            preserveAspectRatio="none"
            className="block h-60 w-full flex-1"
          >
            <defs>
              <linearGradient id="admFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity=".3" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <g stroke="var(--hair)" strokeWidth="1">
              <line x1="0" y1="65" x2="900" y2="65" />
              <line x1="0" y1="130" x2="900" y2="130" />
              <line x1="0" y1="195" x2="900" y2="195" />
            </g>
            <path d={`${LINE_PATH} L900,260 L0,260 Z`} fill="url(#admFill)" />
            <path
              d={LINE_PATH}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              pathLength={1000}
              strokeDasharray="1000"
              strokeDashoffset="1000"
              className="animate-[draw_2.2s_ease_0.2s_forwards]"
            />
          </svg>
          <div className="mt-1.5 flex font-mono text-[10.5px] text-faint">
            <span className="flex-1 text-center">Feb</span>
            <span className="flex-1 text-center">Mar</span>
            <span className="flex-1 text-center">Apr</span>
            <span className="flex-1 text-center">May</span>
            <span className="flex-1 text-center">Jun</span>
            <span className="flex-1 text-center">Jul</span>
          </div>
        </div>
      </section>
    </div>
  )
}
