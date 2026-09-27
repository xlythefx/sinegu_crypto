import { Link } from 'react-router-dom'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgeDollarSign,
  CalendarClock,
  Clock,
  Landmark,
  Receipt,
  Timer,
  Wallet,
} from 'lucide-react'
import DataState from '../../dashboard/DataState'
import MetricTile from '../../analytics/MetricTile'
import { EXCHANGE_META } from '../../exchanges/meta'
import { EmptyNote, GRID_2, InsightCard, TILES } from './parts'
import { useApiData } from '../../../hooks/useApiData'
import { getMoneyInsights } from '../../../services/adminInsights'
import { fmtMoney, fmtShortMonth } from '../../../lib/format'
import type { MoneyInsights } from '../../../types/adminInsights'

/** Invoiced per month, split into collected (green) and still owed (red). */
function RevenueBars({ months }: { months: MoneyInsights['monthly'] }) {
  const max = Math.max(1, ...months.map((m) => m.invoiced))
  if (months.every((m) => m.invoiced === 0)) {
    return <EmptyNote>No invoices issued in the last 12 months.</EmptyNote>
  }
  return (
    <>
      <div className="flex h-[180px] items-end gap-1.5">
        {months.map((m) => (
          <div
            key={m.month}
            className="flex h-full min-w-0 flex-1 flex-col justify-end"
            title={`${fmtShortMonth(m.month)} — invoiced ${fmtMoney(m.invoiced)}, collected ${fmtMoney(m.collected)}, owed ${fmtMoney(m.outstanding)}`}
          >
            <div
              className="w-full rounded-t-[4px] bg-red/70"
              style={{ height: `${(m.outstanding / max) * 100}%` }}
            />
            <div
              className={`w-full bg-green ${m.outstanding > 0 ? '' : 'rounded-t-[4px]'}`}
              style={{ height: `${(m.collected / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {months.map((m) => (
          <span key={m.month} className="min-w-0 flex-1 truncate text-center text-[10px] text-faint">
            {fmtShortMonth(m.month).split(' ')[0]}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-green" /> Collected
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-red/70" /> Still owed
        </span>
      </div>
    </>
  )
}

export default function MoneyTab() {
  const { data, loading, error, reload } = useApiData(getMoneyInsights)

  if (!data) {
    return <DataState loading={loading} error={error} onRetry={reload} label="money stats" />
  }

  const aum = data.under_management
  const net30 = aum.deposits_30d - aum.withdrawals_30d

  return (
    <div className="flex flex-col gap-stack">
      <div className={TILES}>
        <MetricTile label="Fees collected" icon={BadgeDollarSign} value={fmtMoney(data.totals.collected)} tone="pos" sub={`of ${fmtMoney(data.totals.invoiced)} ever invoiced`} />
        <MetricTile
          label="Still owed"
          icon={Receipt}
          value={fmtMoney(data.totals.outstanding)}
          tone={data.totals.outstanding > 0 ? 'neg' : ''}
          sub={`${data.overdue.length} past the due date`}
        />
        <MetricTile
          label="Days to pay"
          icon={Timer}
          value={data.avg_days_to_pay === null ? '—' : `${data.avg_days_to_pay} d`}
          sub="average, invoice to payment"
        />
        <MetricTile
          label="Paid on time"
          icon={CalendarClock}
          value={data.on_time_share === null ? '—' : `${data.on_time_share}%`}
          sub="of paid invoices"
          tone={data.on_time_share !== null && data.on_time_share < 70 ? 'neg' : ''}
        />
      </div>

      <div className={GRID_2}>
        <InsightCard
          icon={BadgeDollarSign}
          title="Revenue by month"
          subtitle="Performance fees invoiced per billing month"
          link={{ to: '/admin/invoices', label: 'Invoices' }}
        >
          <RevenueBars months={data.monthly} />
        </InsightCard>

        <InsightCard
          icon={Landmark}
          title="Money under management"
          subtitle="Live balances on connected exchange accounts"
        >
          <div className="grid grid-cols-2 gap-2.5 max-[480px]:grid-cols-1">
            <MetricTile label="Customers" icon={Wallet} value={fmtMoney(aum.customers)} sub={`${aum.customer_accounts} live account${aum.customer_accounts === 1 ? '' : 's'}`} />
            <MetricTile label="Master" icon={Wallet} value={fmtMoney(aum.master)} sub="the published track record" />
            <MetricTile label="Deposited" icon={ArrowDownToLine} value={fmtMoney(aum.deposits_30d)} tone="pos" sub="by customers, last 30 days" />
            <MetricTile
              label="Withdrawn"
              icon={ArrowUpFromLine}
              value={fmtMoney(aum.withdrawals_30d)}
              tone={aum.withdrawals_30d > 0 ? 'neg' : ''}
              sub={`net ${net30 < 0 ? '−' : '+'}${fmtMoney(net30)} in 30 days`}
            />
          </div>
        </InsightCard>
      </div>

      <div className={GRID_2}>
        <InsightCard
          icon={Clock}
          title="Overdue invoices"
          subtitle="Unpaid past the due date, oldest first"
          link={{ to: '/admin/invoices', label: 'Invoices' }}
        >
          {data.overdue.length === 0 ? (
            <EmptyNote>No invoice is overdue.</EmptyNote>
          ) : (
            <ul className="flex flex-col divide-y divide-hair">
              {data.overdue.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                  <Link to={`/admin/users/${i.uni_id}`} className="min-w-0 hover:text-accent">
                    <span className="block truncate font-semibold">{i.name}</span>
                    <span className="block truncate text-[12px] text-muted">
                      {fmtShortMonth(i.month)} · {EXCHANGE_META[i.exchange]?.label ?? i.exchange}
                    </span>
                  </Link>
                  <span className="flex-none text-right">
                    <span className="block font-mono font-bold">{fmtMoney(i.amount)}</span>
                    <span className="block text-[11.5px] font-semibold text-red">
                      {i.days_late <= 0 ? 'due today' : `${i.days_late} d late`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </InsightCard>

        <InsightCard
          icon={Wallet}
          title="Crypto payments received"
          subtitle="USDT transfers to the receiving wallet"
          link={{ to: '/admin/tron-transfers', label: 'Crypto Transfers' }}
        >
          <div className="grid grid-cols-3 gap-2.5 max-[480px]:grid-cols-1">
            <MetricTile label="Settled" value={String(data.transfers.settled)} tone="pos" sub="paid an invoice" />
            <MetricTile
              label="Unmatched"
              value={String(data.transfers.unmatched)}
              tone={data.transfers.unmatched > 0 ? 'neg' : ''}
              sub="need a human"
            />
            <MetricTile label="Ignored" value={String(data.transfers.ignored)} sub="set aside" />
          </div>
        </InsightCard>
      </div>
    </div>
  )
}
