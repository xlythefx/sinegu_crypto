import { useState } from 'react'
import { Calendar as CalendarIcon, Filter } from 'lucide-react'
import './AdminPerformanceChart.css'

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

  return (
    <div className="apchart" data-aos="fade-up" data-aos-delay="150">
      <div className="apchart__filters">
        <div className="apchart__filter-wrap">
          <button
            type="button"
            className="apchart__filter-btn"
            onClick={() => {
              setShowDates((v) => !v)
              setShowTickers(false)
            }}
          >
            <CalendarIcon size={14} />
            Date Range
          </button>
          {showDates && (
            <div className="apchart__pop">
              <label className="apchart__pop-label">
                From
                <input
                  type="date"
                  className="apchart__date-input"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </label>
              <label className="apchart__pop-label">
                To
                <input
                  type="date"
                  className="apchart__date-input"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </label>
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  className="apchart__clear"
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
        <div className="apchart__filter-wrap">
          <button
            type="button"
            className="apchart__filter-btn"
            onClick={() => {
              setShowTickers((v) => !v)
              setShowDates(false)
            }}
          >
            <Filter size={14} />
            Tickers
          </button>
          {showTickers && (
            <div className="apchart__pop">
              {TICKERS.map((t) => (
                <label className="apchart__ticker" key={t}>
                  <input
                    type="checkbox"
                    className="apchart__check"
                    checked={!excluded.has(t)}
                    onChange={() => toggleTicker(t)}
                  />
                  {t}
                </label>
              ))}
              {excluded.size > 0 && (
                <button
                  type="button"
                  className="apchart__clear"
                  onClick={() => setExcluded(new Set())}
                >
                  Include All
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <section className="dcard apchart__card">
        <div className="apchart__head">
          <div>
            <div className="dcard__title">Master Cumulative P&L</div>
            <div className="dcard__sub">
              Platform performance from the master account
            </div>
          </div>
          <div className="dseg dseg--sm">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`dseg__tab${period === p.key ? ' dseg__tab--active' : ''}`}
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <svg
          viewBox="0 0 900 260"
          preserveAspectRatio="none"
          className="apchart__svg"
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
            className="apchart__line"
          />
        </svg>
        <div className="apchart__xaxis">
          <span>Feb</span>
          <span>Mar</span>
          <span>Apr</span>
          <span>May</span>
          <span>Jun</span>
          <span>Jul</span>
        </div>
      </section>
    </div>
  )
}
