import { Link } from 'react-router-dom'
import { Hand } from 'lucide-react'
import { EXCHANGE_META } from '../../exchanges/meta'
import { OUTSIDE_CLOSE_EXPLAINED } from '../positions/CloseSourceChip'
import { InsightCard } from './parts'
import { Pill } from '../../ui/Pill'
import { displaySymbol } from '../../../lib/chart'
import { fmtDateTime, fmtSignedMoney } from '../../../lib/format'
import type { OutsideCloseRow } from '../../../types/adminInsights'

interface Props {
  count: number
  latest: OutsideCloseRow[]
  /** Whether this viewer may open a page (collaborators get plain rows). */
  mayOpen: (to: string) => boolean
}

const ROW = 'flex items-center justify-between gap-3 py-2.5 text-[13px]'
const ROW_LINK = `${ROW} -mx-2 rounded-btn px-2 transition-colors hover:bg-surface2`

/**
 * Overview → Needs attention: trades closed on the exchange WITHOUT the bot
 * in the last 7 days. Informational, not a fault — so the card stays in the
 * calm accent tone and the P&L is not coloured: it is here to explain why an
 * account took a fresh first entry while every other one was full.
 */
export default function OutsideClosesCard({ count, latest, mayOpen }: Props) {
  return (
    <InsightCard
      icon={Hand}
      title="Closed outside the bot · last 7 days"
      subtitle={OUTSIDE_CLOSE_EXPLAINED}
    >
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-mono text-2xl font-extrabold tracking-[-0.5px] text-accent">
          {count}
        </span>
        <span className="text-[12.5px] text-muted">
          {count === 1 ? 'trade' : 'trades'} closed outside the bot
          {count > latest.length && latest.length > 0 ? ` · newest ${latest.length} below` : ''}
        </span>
      </div>

      <ul className="flex flex-col divide-y divide-hair">
        {latest.map((r) => {
          const to = `/admin/users/${r.uni_id}`
          // MEXC writes LTC_USDT; displaySymbol expects the Binance spelling.
          const detail = [
            displaySymbol(r.symbol.replace(/_/g, '')),
            r.side ? r.side.toUpperCase() : null,
            EXCHANGE_META[r.exchange]?.label ?? r.exchange,
            r.closed_at ? fmtDateTime(r.closed_at) : null,
          ]
            .filter(Boolean)
            .join(' · ')
          const body = (
            <>
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-semibold">
                    {r.account_name || 'Unnamed account'}
                  </span>
                  {r.demo && (
                    <Pill tone="muted" size="xs">
                      Demo
                    </Pill>
                  )}
                </span>
                <span className="block truncate text-[12px] text-muted">{detail}</span>
              </span>
              {r.realized_pnl !== null && (
                <span className="flex flex-none flex-col items-end gap-px">
                  <span className="font-mono text-[13px] font-bold">
                    {fmtSignedMoney(r.realized_pnl)}
                  </span>
                  <span className="text-[10.5px] text-faint">after fees</span>
                </span>
              )}
            </>
          )
          return (
            <li key={`${r.exchange}-${r.id}`}>
              {mayOpen(to) ? (
                <Link to={to} className={ROW_LINK}>
                  {body}
                </Link>
              ) : (
                <div className={ROW}>{body}</div>
              )}
            </li>
          )
        })}
      </ul>
    </InsightCard>
  )
}
