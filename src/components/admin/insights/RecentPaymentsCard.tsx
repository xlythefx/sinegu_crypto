import { Link } from 'react-router-dom'
import { ArrowRight, BadgeDollarSign } from 'lucide-react'
import { EXCHANGE_META } from '../../exchanges/meta'
import { EmptyNote, InsightCard } from './parts'
import { fmtDateTime, fmtMoney } from '../../../lib/format'
import type { RecentPaymentRow, RecentPayments } from '../../../types/adminInsights'

/** How it was paid, in the desk's words. */
const PROVIDER_LABEL: Record<string, string> = {
  stripe: 'Card',
  tron: 'USDT (TRC-20)',
  coinsbuy: 'Crypto (Coinsbuy)',
  manual: 'Marked paid',
}

function paymentMethodLabel(provider: string | null): string {
  return (provider && PROVIDER_LABEL[provider]) || provider || '—'
}

function monthLabel(monthYear: string): string {
  const d = new Date(`${monthYear}-01T00:00:00`)
  return Number.isNaN(d.getTime())
    ? monthYear
    : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function detailLine(p: RecentPaymentRow): string {
  return [
    monthLabel(p.month_year),
    paymentMethodLabel(p.provider),
    EXCHANGE_META[p.exchange]?.label ?? p.exchange,
    p.paid_at ? fmtDateTime(p.paid_at) : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

const ROW = 'flex items-center justify-between gap-3 py-2.5 text-[13px]'
// text-text: a link is accent-coloured app-wide; the name reads as text here.
const ROW_LINK = `${ROW} -mx-2 rounded-btn px-2 text-text transition-colors hover:bg-surface2`

/**
 * Overview → Needs attention: every invoice a customer paid in the last 7
 * days, card AND crypto (2026-11-11 — a card payment settled and nobody could
 * see it: Crypto Transfers only lists USDT). Good news, so it sits after the
 * actionable cards; the same payment also emails the customer and the team
 * and posts in the admin Telegram group.
 */
export default function RecentPaymentsCard({
  payments,
  mayOpen,
}: {
  payments: RecentPayments
  mayOpen: (to: string) => boolean
}) {
  const { count, amount, days, latest } = payments

  return (
    <InsightCard
      icon={BadgeDollarSign}
      title={`Payments received · last ${days} days`}
      subtitle="Every invoice a customer paid, by card or crypto. Each one also emails the customer and the team."
      link={mayOpen('/admin/invoices') ? { to: '/admin/invoices', label: 'Invoice History' } : undefined}
    >
      {count === 0 ? (
        <EmptyNote>No payments in the last {days} days.</EmptyNote>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-mono text-2xl font-extrabold tracking-[-0.5px] text-green">
              {fmtMoney(amount)}
            </span>
            <span className="text-[12.5px] text-muted">
              from {count} {count === 1 ? 'payment' : 'payments'}
              {count > latest.length ? ` · newest ${latest.length} below` : ''}
            </span>
          </div>
          <ul className="flex flex-col divide-y divide-hair">
            {latest.map((p) => {
              const to = `/admin/users/${p.uni_id}`
              const body = (
                <>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{p.name || 'Unnamed customer'}</span>
                    <span className="block truncate text-[12px] text-muted">{detailLine(p)}</span>
                  </span>
                  <span className="flex-none font-mono text-[13px] font-bold text-green">
                    {fmtMoney(p.amount)}
                  </span>
                </>
              )
              return (
                <li key={p.invoice_id}>
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
        </>
      )}
    </InsightCard>
  )
}

/**
 * Platform view: one green line for the newest payment of the last day, so a
 * payment is visible on the page the Overview opens on. Click → Needs attention.
 */
export function RecentPaymentStrip({
  payments,
  onOpen,
}: {
  payments: RecentPayments
  onOpen: () => void
}) {
  const newest = payments.latest[0]
  const since = Date.now() - 24 * 60 * 60 * 1000
  const fresh = payments.latest.filter((p) => p.paid_at && new Date(p.paid_at).getTime() >= since)
  if (!newest || fresh.length === 0) return null

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full cursor-pointer items-center gap-3 rounded-row border border-[color-mix(in_srgb,var(--green)_40%,transparent)] bg-[color-mix(in_srgb,var(--green)_9%,transparent)] px-4 py-3 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--green)_15%,transparent)]"
    >
      <span className="grid h-8 w-8 flex-none place-items-center rounded-[10px] bg-green text-white">
        <BadgeDollarSign size={16} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold text-text">
          {fresh.length === 1
            ? `${newest.name || 'A customer'} paid ${fmtMoney(newest.amount)}`
            : `${fresh.length} payments in the last 24 hours · ${fmtMoney(fresh.reduce((s, p) => s + p.amount, 0))}`}
        </span>
        <span className="block truncate text-[12.5px] text-muted">
          {fresh.length === 1 ? detailLine(newest) : `Newest: ${newest.name || 'A customer'} · ${detailLine(newest)}`}
        </span>
      </span>
      <span className="inline-flex flex-none items-center gap-1 text-[12.5px] font-bold text-green max-[480px]:hidden">
        See payments <ArrowRight size={14} aria-hidden="true" />
      </span>
    </button>
  )
}
