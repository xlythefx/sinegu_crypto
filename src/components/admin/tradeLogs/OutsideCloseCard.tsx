import { Hand } from 'lucide-react'
import ExchangeBadge from '../../billing/ExchangeBadge'
import SideTypePill from './SideTypePill'
import { OUTSIDE_CLOSE_EXPLAINED } from '../positions/CloseSourceChip'
import { fmtDateTime, fmtMoney, fmtQty, fmtSignedMoney } from '../../../lib/format'
import type { OutsideCloseRow } from '../../../types/tradeLogs'

const META = 'text-[11.5px] text-faint'

/**
 * A position the customer closed on the exchange WITHOUT the bot, as its own
 * row in the Signal Log timeline — amber, never red: it explains why the next
 * signal treated that account as empty, it is not a fault.
 */
export default function OutsideCloseCard({ row }: { row: OutsideCloseRow }) {
  const pnl = row.realizedPnl
  const tone = pnl === null ? 'text-muted' : pnl >= 0 ? 'text-green' : 'text-red'

  return (
    <article className="overflow-hidden rounded-card border border-accent-line bg-surface">
      <div className="flex gap-3 border-l-[3px] border-l-accent p-card max-[480px]:p-3.5">
        <span className="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-[10px] bg-accent-soft text-accent">
          <Hand size={15} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-pill border border-accent-line bg-accent-soft px-2.5 py-[3px] text-[10.5px] font-bold uppercase tracking-[0.06em] text-accent">
              Closed outside the bot
            </span>
            <SideTypePill side={row.side} type="exit" />
            <span className="font-mono text-[13.5px] font-semibold text-text">{row.ticker}</span>
            <ExchangeBadge exchange={row.exchange} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={META}>{row.ts ? fmtDateTime(row.ts) : '—'}</span>
            <span className="text-[12px] font-semibold text-text">
              {row.account ?? 'Unnamed account'}
              {row.userName && <span className="font-normal text-faint"> · {row.userName}</span>}
            </span>
            {row.demo && (
              <span className="rounded-pill border border-hair px-2 py-[1px] text-[10px] font-semibold uppercase tracking-[0.05em] text-faint">
                Demo
              </span>
            )}
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] text-muted">
            <span>{fmtQty(row.quantity, 0, 8)} closed</span>
            {(row.entryPrice !== null || row.exitPrice !== null) && (
              <span>
                In {row.entryPrice !== null ? fmtMoney(row.entryPrice, 4) : '—'} → Out{' '}
                {row.exitPrice !== null ? fmtMoney(row.exitPrice, 4) : '—'}
              </span>
            )}
            {pnl !== null && <span className={`font-semibold ${tone}`}>{fmtSignedMoney(pnl)}</span>}
            {row.exchangeFee !== null && <span className="text-faint">fee {fmtMoney(row.exchangeFee)}</span>}
          </p>
          <p className="mt-1.5 text-[11.5px] leading-[1.5] text-faint">{OUTSIDE_CLOSE_EXPLAINED}</p>
        </div>
      </div>
    </article>
  )
}
