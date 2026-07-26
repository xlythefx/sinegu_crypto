import { Building2, Layers, Tags, X } from 'lucide-react'
import { AVAILABLE_EXCHANGES, EXCHANGES, type ExchangeFilter } from './types'

interface Props {
  exchange: ExchangeFilter
  setExchange: (v: ExchangeFilter) => void
  ticker: string
  setTicker: (v: string) => void
  strategy: string
  setStrategy: (v: string) => void
  onClear: () => void
  /** Options derived from the loaded positions. */
  tickers: string[]
  strategies: string[]
}

const FIELD =
  'flex items-center gap-1.5 h-9 px-2.5 border border-border rounded-field bg-surface text-muted cursor-pointer'
const SELECT =
  'border-0 bg-transparent text-text font-body text-[12.5px] font-semibold outline-none cursor-pointer max-w-[150px] max-[640px]:max-w-none max-[640px]:w-full'

/** Faceted filter row: Exchange / Ticker / Strategy selects + Clear. */
export default function PositionFilters({
  exchange,
  setExchange,
  ticker,
  setTicker,
  strategy,
  setStrategy,
  onClear,
  tickers,
  strategies,
}: Props) {
  const hasActive = exchange !== 'all' || ticker !== 'all' || strategy !== 'all'

  return (
    <div className="flex items-center justify-end gap-2 flex-wrap max-[640px]:justify-start">
      <label className={`${FIELD} max-[640px]:flex-1 max-[640px]:basis-[140px]`}>
        <Building2 size={14} />
        <select
          className={SELECT}
          value={exchange}
          onChange={(e) => setExchange(e.target.value as ExchangeFilter)}
          aria-label="Filter by exchange"
        >
          <option className="bg-surface text-text" value="all">
            All Exchanges
          </option>
          {EXCHANGES.map((x) => (
            <option
              key={x}
              className="bg-surface text-text"
              value={x}
              disabled={!AVAILABLE_EXCHANGES.includes(x)}
            >
              {AVAILABLE_EXCHANGES.includes(x) ? x : `${x} (soon)`}
            </option>
          ))}
        </select>
      </label>
      <label className={`${FIELD} max-[640px]:flex-1 max-[640px]:basis-[140px]`}>
        <Tags size={14} />
        <select
          className={SELECT}
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          aria-label="Filter by ticker"
        >
          <option className="bg-surface text-text" value="all">
            All Tickers
          </option>
          {tickers.map((t) => (
            <option key={t} className="bg-surface text-text" value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className={`${FIELD} max-[640px]:flex-1 max-[640px]:basis-[140px]`}>
        <Layers size={14} />
        <select
          className={SELECT}
          value={strategy}
          onChange={(e) => setStrategy(e.target.value)}
          aria-label="Filter by strategy"
        >
          <option className="bg-surface text-text" value="all">
            All Strategies
          </option>
          {strategies.map((s) => (
            <option key={s} className="bg-surface text-text" value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      {hasActive && (
        <button
          type="button"
          className="flex items-center gap-1 h-8 px-2.5 rounded-btn bg-transparent text-muted text-[12px] font-semibold cursor-pointer hover:text-text hover:bg-surface2"
          onClick={onClear}
        >
          <X size={12} />
          Clear
        </button>
      )}
    </div>
  )
}
