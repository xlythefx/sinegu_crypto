import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  BadgeDollarSign,
  CheckCircle2,
  Clock,
  KeyRound,
  Radio,
  Receipt,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import DataState from '../../dashboard/DataState'
import MetricTile from '../../analytics/MetricTile'
import { EXCHANGE_META } from '../../exchanges/meta'
import { BarRow, EmptyNote, GRID_2, InsightCard, TILES } from './parts'
import { useApiData } from '../../../hooks/useApiData'
import { getOverviewInsights } from '../../../services/adminInsights'
import { fmtMoney, fmtSignedMoney } from '../../../lib/format'
import { reasonLabel } from '../../../lib/insightLabels'
import type { OverviewInsights } from '../../../types/adminInsights'

interface AttentionItem {
  key: string
  icon: typeof AlertTriangle
  text: string
  detail: string
  to: string
  urgent: boolean
}

/** One line per thing that is costing money or customers right now. */
function attentionItems(a: OverviewInsights['attention']): AttentionItem[] {
  const items: AttentionItem[] = []
  if (a.blocked_keys_count > 0) {
    const soonest = a.blocked_keys[0]?.days_left
    items.push({
      key: 'keys',
      icon: KeyRound,
      text: `${a.blocked_keys_count} API ${a.blocked_keys_count === 1 ? 'key is' : 'keys are'} refused by the exchange`,
      detail:
        soonest !== null && soonest !== undefined
          ? `Those accounts take no trades. The first is disconnected ${soonest <= 0 ? 'on the next daily run' : `in ${soonest} day${soonest === 1 ? '' : 's'}`}.`
          : 'Those accounts take no trades until the key is fixed.',
      to: '/admin/api-keys',
      urgent: true,
    })
  }
  if (a.overdue_invoices.count > 0) {
    items.push({
      key: 'overdue',
      icon: Receipt,
      text: `${a.overdue_invoices.count} overdue ${a.overdue_invoices.count === 1 ? 'invoice' : 'invoices'} · ${fmtMoney(a.overdue_invoices.amount)}`,
      detail:
        a.paused_for_payment > 0
          ? `${a.paused_for_payment} account${a.paused_for_payment === 1 ? ' is' : 's are'} paused until paid.`
          : 'Unpaid past the due date.',
      to: '/admin/invoices',
      urgent: true,
    })
  }
  if (a.unmatched_transfers > 0) {
    items.push({
      key: 'transfers',
      icon: Wallet,
      text: `${a.unmatched_transfers} crypto ${a.unmatched_transfers === 1 ? 'payment' : 'payments'} could not be matched to an invoice`,
      detail: 'Money arrived, but no invoice was settled. Attribute or ignore it.',
      to: '/admin/tron-transfers',
      urgent: true,
    })
  }
  if (a.signals_today.failed > 0) {
    items.push({
      key: 'failed',
      icon: AlertTriangle,
      text: `${a.signals_today.failed} order${a.signals_today.failed === 1 ? '' : 's'} refused by an exchange today`,
      detail: 'Check the Signal Log for which accounts and why.',
      to: '/admin/trade-logs',
      urgent: true,
    })
  }
  if (a.pending_users_count > 0) {
    items.push({
      key: 'pending',
      icon: UserPlus,
      text: `${a.pending_users_count} sign-up${a.pending_users_count === 1 ? '' : 's'} waiting for approval`,
      detail: a.pending_users.slice(0, 3).map((u) => u.name).join(', '),
      to: '/admin/users',
      urgent: false,
    })
  }
  return items
}

export default function OverviewTab() {
  const { data, loading, error, reload } = useApiData(getOverviewInsights)

  if (!data) {
    return <DataState loading={loading} error={error} onRetry={reload} label="overview" />
  }

  const { attention: a, headline: h } = data
  const items = attentionItems(a)
  const reasons = Object.entries(a.signals_today.reasons)
  const maxReason = Math.max(0, ...reasons.map(([, n]) => n))

  return (
    <div className="flex flex-col gap-stack">
      <div className={TILES}>
        <MetricTile
          label="Master balance"
          icon={Wallet}
          value={h.master_balance === null ? '—' : fmtMoney(h.master_balance)}
          sub={
            h.master_today_trades > 0
              ? `${fmtSignedMoney(h.master_today_pnl)} today · ${h.master_today_trades} closed`
              : 'No trade closed today'
          }
          subTone={h.master_today_pnl > 0 ? 'pos' : h.master_today_pnl < 0 ? 'neg' : ''}
        />
        <MetricTile
          label="Traded today"
          icon={Users}
          value={String(h.active_traders_today)}
          sub={`of ${h.customers_live} customer${h.customers_live === 1 ? '' : 's'} connected`}
        />
        <MetricTile
          label="Collected this month"
          icon={BadgeDollarSign}
          value={fmtMoney(h.collected_this_month)}
          tone={h.collected_this_month > 0 ? 'pos' : ''}
          sub={
            a.unpaid_invoices.count > 0
              ? `${fmtMoney(a.unpaid_invoices.amount)} still unpaid`
              : 'Nothing unpaid'
          }
        />
        <MetricTile
          label="Signals today"
          icon={Radio}
          value={String(a.signals_today.signals)}
          sub={
            a.signals_today.with_problems > 0
              ? `${a.signals_today.with_problems} with a skipped or failed account`
              : 'All clean'
          }
          subTone={a.signals_today.with_problems > 0 ? 'neg' : 'pos'}
        />
      </div>

      <InsightCard
        icon={AlertTriangle}
        title="Needs attention"
        subtitle="Anything here is costing money or customers. Empty means all is well."
      >
        {items.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-row border border-border bg-surface2 px-4 py-4 text-[13.5px]">
            <CheckCircle2 size={18} className="flex-none text-green" />
            Nothing needs you right now.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map(({ key, icon: Icon, text, detail, to, urgent }) => (
              <li key={key}>
                <Link
                  to={to}
                  className="flex items-start gap-3 rounded-row border border-border bg-surface2 px-4 py-3 transition-colors hover:border-accent-line hover:bg-accent-soft"
                >
                  <Icon
                    size={17}
                    className={`mt-0.5 flex-none ${urgent ? 'text-red' : 'text-accent'}`}
                  />
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-semibold">{text}</span>
                    {detail && (
                      <span className="mt-0.5 block text-[12.5px] text-muted">{detail}</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </InsightCard>

      <div className={GRID_2}>
        <InsightCard
          icon={Radio}
          title="Why accounts missed today's trades"
          subtitle="Each account passed over on a signal, by reason"
          link={{ to: '/admin/trade-logs', label: 'Signal Log' }}
        >
          {reasons.length === 0 ? (
            <EmptyNote>No account was passed over today.</EmptyNote>
          ) : (
            <div className="flex flex-col gap-3">
              {reasons.map(([reason, n]) => (
                <BarRow key={reason} label={reasonLabel(reason)} value={n} max={maxReason} tone="red" />
              ))}
            </div>
          )}
        </InsightCard>

        <InsightCard
          icon={Clock}
          title="Keys running out of time"
          subtitle="Refused keys, soonest disconnection first"
          link={{ to: '/admin/api-keys', label: 'API Keys' }}
        >
          {a.blocked_keys.length === 0 ? (
            <EmptyNote>Every connected key works.</EmptyNote>
          ) : (
            <ul className="flex flex-col divide-y divide-hair">
              {a.blocked_keys.slice(0, 8).map((k) => (
                <li
                  key={`${k.exchange}-${k.id}`}
                  className="flex items-center justify-between gap-3 py-2.5 text-[13px]"
                >
                  <Link to={`/admin/users/${k.uni_id}`} className="min-w-0 hover:text-accent">
                    <span className="block truncate font-semibold">{k.owner}</span>
                    <span className="block truncate text-[12px] text-muted">
                      {EXCHANGE_META[k.exchange]?.label ?? k.exchange} · {k.account}
                      {k.demo ? ' · demo' : ''}
                    </span>
                  </Link>
                  <span
                    className={`flex-none rounded-pill px-2.5 py-1 font-mono text-[11.5px] font-bold ${
                      (k.days_left ?? 9) <= 1 ? 'bg-red/15 text-red' : 'bg-surface2 text-muted'
                    }`}
                  >
                    {k.days_left === null
                      ? '—'
                      : k.days_left <= 0
                        ? 'due now'
                        : `${k.days_left} d left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </InsightCard>
      </div>
    </div>
  )
}
