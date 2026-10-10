import { useId, type ReactNode } from 'react'
import { Unlink } from 'lucide-react'
import ExchangeLogo from '../../exchanges/ExchangeLogo'
import { EXCHANGE_META } from '../../exchanges/meta'
import { groupLabel } from './exchangeGroups'
import type { ExchangeKind } from '../../../types/exchanges'

interface ExchangeSectionProps {
  /** null = the coins whose broker names no supported exchange. */
  exchange: ExchangeKind | null
  /** One line under the name: "2 coins · 2 on", "No Bybit coins yet", … */
  summary: ReactNode
  /** Muted full-width line inside the header (e.g. the venue is not trading yet). */
  note?: string | null
  /** Right-hand control, e.g. "+ Add Binance coin". */
  action?: ReactNode
  /** The section's cards. Omit for a header-only (empty) section. */
  children?: ReactNode
}

/**
 * One exchange's block on Admin → Trading Assets: a header bar carrying the
 * venue's logo, name and brand stripe, then its cards. The same coin exists
 * once per venue, so the venue has to be the first thing read, not a word in
 * a card's subtitle.
 */
export default function ExchangeSection({
  exchange,
  summary,
  note,
  action,
  children,
}: ExchangeSectionProps) {
  const headingId = useId()
  const stripe = exchange ? EXCHANGE_META[exchange].color : 'var(--border)'

  return (
    <section className="flex flex-col gap-3.5" aria-labelledby={headingId}>
      <header
        className="flex flex-wrap items-center gap-x-3.5 gap-y-3 rounded-card border border-l-[3px] border-border bg-surface py-3 pl-3.5 pr-3 sm:pr-4"
        style={{ borderLeftColor: stripe }}
      >
        {exchange ? (
          <ExchangeLogo kind={exchange} size={40} />
        ) : (
          <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-btn border border-border bg-surface2 text-faint">
            <Unlink size={17} aria-hidden="true" />
          </span>
        )}

        <div className="min-w-[140px] flex-1">
          <h2 id={headingId} className="font-display text-[16px] font-extrabold leading-tight">
            {groupLabel(exchange)}
          </h2>
          <p className="mt-1 text-[12px] leading-snug text-muted">{summary}</p>
        </div>

        {action && <div className="flex-none">{action}</div>}

        {note && (
          <p className="basis-full border-t border-hair pt-2.5 text-[12px] leading-[1.5] text-faint">
            {note}
          </p>
        )}
      </header>

      {children}
    </section>
  )
}
