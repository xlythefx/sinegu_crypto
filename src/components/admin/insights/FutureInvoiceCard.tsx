import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Hourglass } from 'lucide-react'
import { EXCHANGE_META } from '../../exchanges/meta'
import { EmptyNote, InsightCard } from './parts'
import { fmtDateTime, fmtMoney, fmtShortMonth, fmtSignedMoney } from '../../../lib/format'
import type { InvoiceForecast } from '../../../types/adminInsights'

/** Rows shown before "Show all". */
const PREVIEW_ROWS = 6

const STATUS_NOTE: Record<InvoiceForecast['accounts'][number]['status'], string> = {
  billable: '',
  below_hwm: 'below high-water mark',
  no_profit: 'no profit yet',
}

/**
 * The running month's realized performance fee if it were billed right now.
 * Moves with every close until the month ends; the unrealized share is left
 * out on purpose (it swings with open positions).
 */
export default function FutureInvoiceCard({ forecast }: { forecast: InvoiceForecast }) {
  const [showAll, setShowAll] = useState(false)
  const rows = showAll ? forecast.accounts : forecast.accounts.slice(0, PREVIEW_ROWS)
  const hidden = forecast.accounts.length - rows.length

  return (
    <InsightCard
      icon={Hourglass}
      title="Future invoice"
      subtitle={`${fmtShortMonth(forecast.month)} so far — realized fees if the month were billed now`}
      link={{ to: '/admin/invoices', label: 'Invoices' }}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <div className="font-mono text-[28px] font-bold leading-none text-green">
            {fmtMoney(forecast.total)}
          </div>
          <div className="mt-1.5 text-[12px] text-muted">
            {forecast.billable_accounts} of {forecast.accounts.length} accounts billable · as of{' '}
            {fmtDateTime(forecast.as_of)}
          </div>
        </div>
        <div className="text-right">
          <div className={`font-mono text-[15px] font-bold ${forecast.realized_pnl < 0 ? 'text-red' : ''}`}>
            {fmtSignedMoney(forecast.realized_pnl)}
          </div>
          <div className="mt-0.5 text-[12px] text-muted">customers' realized P&amp;L this month</div>
        </div>
      </div>

      {forecast.accounts.length === 0 ? (
        <EmptyNote>No customer account can be invoiced yet.</EmptyNote>
      ) : (
        <ul className="flex flex-col divide-y divide-hair">
          {rows.map((r) => (
            <li key={`${r.exchange}-${r.uni_id}-${r.account}`} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
              <Link to={`/admin/users/${r.uni_id}`} className="min-w-0 hover:text-accent">
                <span className="block truncate font-semibold">{r.name}</span>
                <span className="block truncate text-[12px] text-muted">
                  {EXCHANGE_META[r.exchange]?.label ?? r.exchange} · {fmtSignedMoney(r.realized_pnl)} realized
                  {r.status === 'billable' && ` · ${r.rate}%`}
                </span>
              </Link>
              <span className="flex-none text-right">
                <span className={`block font-mono font-bold ${r.status === 'billable' ? '' : 'text-faint'}`}>
                  {fmtMoney(r.fee)}
                </span>
                {r.status !== 'billable' && (
                  <span
                    className="block text-[11.5px] text-muted"
                    title={r.status === 'below_hwm' ? `Equity ${fmtMoney(r.equity)} ≤ high-water mark ${fmtMoney(r.hwm)}` : undefined}
                  >
                    {STATUS_NOTE[r.status]}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2 self-start rounded-btn px-2 py-1 text-[12px] font-semibold text-accent hover:bg-accent-soft"
        >
          Show all {forecast.accounts.length}
        </button>
      )}

      <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
        An estimate that changes with every closed trade until month end. Realized fees only — open positions are
        not counted. Same rules as the real invoice: only equity above the high-water mark is billed.
        {forecast.not_supported.map((n) => (
          <span key={n.exchange}>
            {' '}
            {n.accounts} {EXCHANGE_META[n.exchange]?.label ?? n.exchange} account{n.accounts === 1 ? '' : 's'} not
            included — invoicing does not read that exchange yet.
          </span>
        ))}
      </p>
    </InsightCard>
  )
}
