import { Layers } from 'lucide-react'
import ExchangeLogo from '../../exchanges/ExchangeLogo'
import { EXCHANGE_META, EXCHANGE_ORDER } from '../../exchanges/meta'
import { coinCount, type ExchangeFilter } from './exchangeGroups'
import type { ExchangeKind } from '../../../types/exchanges'

interface ExchangeSwitcherProps {
  value: ExchangeFilter
  onChange: (next: ExchangeFilter) => void
  /** Assets per exchange — the whole list, not the search results, so the pills never jump while typing. */
  counts: Record<ExchangeKind, number>
  /** Every asset, including any with no exchange set. */
  total: number
}

const PILL =
  'inline-flex h-9 flex-none items-center gap-2 whitespace-nowrap rounded-pill border py-1 pl-1.5 pr-2.5 text-[12.5px] font-semibold transition-[border-color,background,color] duration-150'
const PILL_ON = 'border-accent bg-accent-soft text-text'
const PILL_OFF = 'border-border bg-surface text-muted hover:border-accent hover:text-text'

function Count({ n, on }: { n: number; on: boolean }) {
  return (
    <span
      className={`min-w-[20px] rounded-pill px-1.5 text-center font-mono text-[10.5px] font-bold leading-[18px] ${
        on ? 'bg-accent text-on-accent' : 'bg-surface2 text-faint'
      }`}
    >
      {n}
    </span>
  )
}

/**
 * All · Binance · Bybit · MEXC, each with its logo and how many coins it has.
 * Pills that WRAP rather than a scrolling strip: four of them do not fit a
 * phone's width, and a scrolled-off MEXC is a venue nobody finds.
 */
export default function ExchangeSwitcher({ value, onChange, counts, total }: ExchangeSwitcherProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Show coins on">
      <button
        type="button"
        className={`${PILL} ${value === 'all' ? PILL_ON : PILL_OFF}`}
        aria-pressed={value === 'all'}
        aria-label={`All exchanges, ${coinCount(total)}`}
        onClick={() => onChange('all')}
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-[5px] border border-border bg-surface2 text-muted">
          <Layers size={13} aria-hidden="true" />
        </span>
        All
        <Count n={total} on={value === 'all'} />
      </button>

      {EXCHANGE_ORDER.map((kind) => {
        const on = value === kind
        const label = EXCHANGE_META[kind].label
        return (
          <button
            key={kind}
            type="button"
            className={`${PILL} ${on ? PILL_ON : PILL_OFF}`}
            aria-pressed={on}
            aria-label={`${label}, ${coinCount(counts[kind])}`}
            onClick={() => onChange(kind)}
          >
            <ExchangeLogo kind={kind} size={24} />
            {label}
            <Count n={counts[kind]} on={on} />
          </button>
        )
      })}
    </div>
  )
}
