import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  BadgeDollarSign,
  CheckCircle2,
  Clock,
  KeyRound,
  Radio,
  Receipt,
  ShieldAlert,
  Users,
  Wallet,
} from 'lucide-react'
import DataState from '../../dashboard/DataState'
import MetricTile from '../../analytics/MetricTile'
import { EXCHANGE_META } from '../../exchanges/meta'
import { BarRow, EmptyNote, GRID_2, InsightCard, TILES } from './parts'
import PendingApprovalsCard from './PendingApprovalsCard'
import type { ApiDataState } from '../../../hooks/useApiData'
import { fmtMoney, fmtSignedMoney } from '../../../lib/format'
import { reasonLabel } from '../../../lib/insightLabels'
import { useSessionUser } from '../../../hooks/useSessionUser'
import { collaboratorMayOpen, isCollaborator } from '../../../lib/roles'
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
  // Billing and key-health keys are absent for a read-only collaborator.
  const blockedCount = a.blocked_keys_count ?? 0
  if (blockedCount > 0) {
    const soonest = a.blocked_keys?.[0]?.days_left
    items.push({
      key: 'keys',
      icon: KeyRound,
      text: `${blockedCount} API ${blockedCount === 1 ? 'key is' : 'keys are'} refused by the exchange`,
      detail:
        soonest !== null && soonest !== undefined
          ? `Those accounts take no trades. The first is disconnected ${soonest <= 0 ? 'on the next daily run' : `in ${soonest} day${soonest === 1 ? '' : 's'}`}.`
          : 'Those accounts take no trades until the key is fixed.',
      to: '/admin/api-keys',
      urgent: true,
    })
  }
  const overdue = a.overdue_invoices
  const paused = a.paused_for_payment ?? 0
  if (overdue && overdue.count > 0) {
    items.push({
      key: 'overdue',
      icon: Receipt,
      text: `${overdue.count} overdue ${overdue.count === 1 ? 'invoice' : 'invoices'} · ${fmtMoney(overdue.amount)}`,
      detail:
        paused > 0
          ? `${paused} account${paused === 1 ? ' is' : 's are'} paused until paid.`
          : 'Unpaid past the due date.',
      to: '/admin/invoices',
      urgent: true,
    })
  }
  const disputed = a.disputed_payments ?? 0
  if (disputed > 0) {
    items.push({
      key: 'disputes',
      icon: ShieldAlert,
      text: `${disputed} crypto ${disputed === 1 ? 'payment is' : 'payments are'} claimed by two customers`,
      detail: 'Both entered the same transaction ID. Find out who really sent it, fix the invoices, mark it resolved.',
      to: '/admin/tron-transfers?status=disputed',
      urgent: true,
    })
  }
  const unmatched = a.unmatched_transfers ?? 0
  if (unmatched > 0) {
    items.push({
      key: 'transfers',
      icon: Wallet,
      text: `${unmatched} crypto ${unmatched === 1 ? 'payment' : 'payments'} could not be matched to an invoice`,
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
  // Pending sign-ups are not a row here: they get their own card above,
  // with the approve / reject buttons (PendingApprovalsCard).
  return items
}

const ROW = 'flex items-start gap-3 rounded-row border border-border bg-surface2 px-4 py-3'
const ROW_LINK = `${ROW} transition-colors hover:border-accent-line hover:bg-accent-soft`

/**
 * Overview → Needs attention: what is costing money or customers right now.
 * The payload is fetched by OverviewTab (the Platform strip reads it too).
 */
export default function AttentionPane({
  data,
  loading,
  error,
  reload,
}: ApiDataState<OverviewInsights>) {
  // A read-only collaborator may not open most of the pages these rows point
  // at (Signal Log, API Keys, invoices…), so those render as plain text.
  const collaborator = isCollaborator(useSessionUser()?.type)
  const mayOpen = (to: string) => !collaborator || collaboratorMayOpen(to)
  const cardLink = (to: string, label: string) => (mayOpen(to) ? { to, label } : undefined)

  if (!data) {
    return <DataState loading={loading} error={error} onRetry={reload} label="overview" />
  }

  const { attention: a, headline: h } = data
  const items = attentionItems(a)
  const reasons = Object.entries(a.signals_today.reasons)
  const maxReason = Math.max(0, ...reasons.map(([, n]) => n))

  return (
    <div className="flex flex-col gap-stack">
      {a.pending_users_count > 0 && (
        <PendingApprovalsCard
          users={a.pending_users}
          count={a.pending_users_count}
          readOnly={collaborator}
          onResolved={reload}
        />
      )}

      {/* Three tiles when "Collected this month" is absent (collaborator) —
          no empty fourth column. */}
      <div
        className={
          h.collected_this_month === undefined
            ? 'grid grid-cols-3 gap-2.5 max-[900px]:grid-cols-2 max-[480px]:grid-cols-1'
            : TILES
        }
      >
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
        {h.collected_this_month !== undefined && (
          <MetricTile
            label="Collected this month"
            icon={BadgeDollarSign}
            value={fmtMoney(h.collected_this_month)}
            tone={h.collected_this_month > 0 ? 'pos' : ''}
            sub={
              a.unpaid_invoices && a.unpaid_invoices.count > 0
                ? `${fmtMoney(a.unpaid_invoices.amount)} still unpaid`
                : 'Nothing unpaid'
            }
          />
        )}
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
            {a.pending_users_count > 0
              ? 'Nothing else needs you right now.'
              : 'Nothing needs you right now.'}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map(({ key, icon: Icon, text, detail, to, urgent }) => {
              const body = (
                <>
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
                </>
              )
              return (
                <li key={key}>
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
        )}
      </InsightCard>

      <div className={a.blocked_keys ? GRID_2 : 'flex flex-col gap-stack'}>
        <InsightCard
          icon={Radio}
          title="Why accounts missed today's trades"
          subtitle="Each account passed over on a signal, by reason"
          link={cardLink('/admin/trade-logs', 'Signal Log')}
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

        {a.blocked_keys && (
        <InsightCard
          icon={Clock}
          title="Keys running out of time"
          subtitle="Refused keys, soonest disconnection first"
          link={cardLink('/admin/api-keys', 'API Keys')}
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
                  {(() => {
                    const owner = (
                      <>
                        <span className="block truncate font-semibold">{k.owner}</span>
                        <span className="block truncate text-[12px] text-muted">
                          {EXCHANGE_META[k.exchange]?.label ?? k.exchange} · {k.account}
                          {k.demo ? ' · demo' : ''}
                        </span>
                      </>
                    )
                    return collaborator ? (
                      <span className="min-w-0">{owner}</span>
                    ) : (
                      <Link to={`/admin/users/${k.uni_id}`} className="min-w-0 hover:text-accent">
                        {owner}
                      </Link>
                    )
                  })()}
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
        )}
      </div>
    </div>
  )
}
