import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronDown, Search, Send, Users } from 'lucide-react'
import ReferrerReferralsList from './ReferrerReferralsList'
import ReferrerPayoutsPanel from './ReferrerPayoutsPanel'
import { fmtMoney } from '../../../lib/format'
import type { AdminReferrer } from '../../../types/referrals'

type StatusFilter = 'all' | 'overdue' | 'pending' | 'paid' | 'unreleased' | 'released'

const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All statuses' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'pending', label: 'Pending' },
  { key: 'paid', label: 'Paid' },
  { key: 'unreleased', label: 'Unreleased' },
  { key: 'released', label: 'Released' },
]

const PILL =
  'inline-block text-[10px] font-bold uppercase tracking-[0.05em] py-[3px] px-[9px] rounded-pill whitespace-nowrap'
const TAB_BTN =
  'text-[12.5px] font-semibold py-[7px] px-4 rounded-btn cursor-pointer transition-colors duration-150'

/** State-driven accent tint for a referrer row — theme tokens only. */
function rowTint(r: AdminReferrer): string {
  if (r.referrerOverdue)
    return 'border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_5%,transparent)]'
  if (r.referrerPending)
    return 'border-[color-mix(in_srgb,var(--accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]'
  if (r.referrals.length > 0)
    return 'border-[color-mix(in_srgb,var(--green)_30%,transparent)] bg-[color-mix(in_srgb,var(--green)_4%,transparent)]'
  return 'border-border bg-surface2'
}

function matchesFilter(r: AdminReferrer, filter: StatusFilter): boolean {
  switch (filter) {
    case 'overdue':
      return r.referrerOverdue
    case 'pending':
      return r.referrerPending
    case 'paid':
      return !r.referrerOverdue && !r.referrerPending && r.referrals.length > 0
    case 'unreleased':
      return r.hasReleasable
    case 'released':
      return r.hasReleased
    default:
      return true
  }
}

/** Expanded body — sub-tab state lives here so it resets when a row collapses. */
function ExpandedBody({
  referrer,
  onReload,
}: {
  referrer: AdminReferrer
  onReload: () => void
}) {
  const [subTab, setSubTab] = useState<'referrals' | 'payouts'>('referrals')

  return (
    <div className="border-t border-hair p-3.5">
      <div
        className="inline-flex gap-1 p-1 border border-border rounded-[12px] bg-surface mb-3.5"
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'referrals'}
          className={`${TAB_BTN} ${
            subTab === 'referrals'
              ? 'bg-accent text-on-accent'
              : 'bg-transparent text-muted hover:text-text'
          }`}
          onClick={() => setSubTab('referrals')}
        >
          Referrals ({referrer.referrals.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'payouts'}
          className={`${TAB_BTN} ${
            subTab === 'payouts'
              ? 'bg-accent text-on-accent'
              : 'bg-transparent text-muted hover:text-text'
          }`}
          onClick={() => setSubTab('payouts')}
        >
          Released payments
        </button>
      </div>

      <div key={subTab} className="animate-[fadeup_0.35s_ease-out]">
        {subTab === 'referrals' ? (
          <ReferrerReferralsList members={referrer.referrals} />
        ) : (
          <ReferrerPayoutsPanel
            referrerUniId={referrer.userUniId}
            onChanged={onReload}
          />
        )}
      </div>
    </div>
  )
}

interface ReferrerAccordionProps {
  referrers: AdminReferrer[]
  /** Reloads the overview after a mutation deeper down (payout undo). */
  onReload: () => void
}

/** "Affiliate overview" tab — searchable, filterable referrer accordion. */
export default function ReferrerAccordion({
  referrers,
  onReload,
}: ReferrerAccordionProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const filtered = useMemo(() => {
    let list = referrers.filter((r) => matchesFilter(r, statusFilter))
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((r) =>
        `${r.code} ${r.referrerName} ${r.referrerEmail}`.toLowerCase().includes(q),
      )
    }
    return list
  }, [referrers, statusFilter, search])

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <section
      className="rounded-card border border-border bg-surface p-[18px]"
      data-aos="fade-up"
    >
      {/* toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <label className="flex items-center gap-[9px] border border-border rounded-[12px] bg-surface2 px-3.5 text-muted w-full max-w-[340px]">
          <Search size={14} />
          <input
            type="search"
            placeholder="Search code, name, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-0 h-10 border-none outline-none bg-transparent text-text text-[13px] font-body"
          />
        </label>
        <select
          className="h-[38px] border border-border rounded-[12px] bg-surface2 text-text px-3 text-[12.5px] font-body cursor-pointer"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* list — key excludes free-text search so typing doesn't replay the reveal */}
      <div key={statusFilter} className="animate-[fadeup_0.35s_ease-out]">
        {filtered.length === 0 ? (
          <div className="rounded-row border border-dashed border-border flex flex-col items-center text-center py-10 px-6">
            <Users size={38} className="text-faint mb-3" />
            <h3 className="text-[15px] font-bold mb-1">
              {referrers.length === 0 ? 'No referrers yet' : 'No matches'}
            </h3>
            <p className="text-[12.5px] text-muted max-w-[380px]">
              {referrers.length === 0
                ? 'Users appear here once they generate a referral code.'
                : 'No referrers match your filters or search.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((r) => {
              const open = expanded.has(r.referralId)
              const paidCount = r.referrals.filter(
                (m) => m.paymentReleaseStatus === 'paid',
              ).length
              const total = r.referrals.length

              return (
                <div
                  key={r.referralId}
                  className={`rounded-row border ${rowTint(r)}`}
                >
                  <div className="flex items-start gap-3 flex-wrap p-3.5">
                    <button
                      type="button"
                      className="flex-1 min-w-[220px] flex items-start gap-2.5 text-left cursor-pointer"
                      onClick={() => toggle(r.referralId)}
                      aria-expanded={open}
                    >
                      <ChevronDown
                        size={16}
                        className={`flex-none mt-0.5 text-faint transition-transform duration-150 ${
                          open ? 'rotate-180' : ''
                        }`}
                      />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[13px] font-bold text-text tracking-[0.04em]">
                            {r.code}
                          </span>
                          <span className={`${PILL} bg-surface border border-border text-muted`}>
                            {total} referral{total === 1 ? '' : 's'}
                          </span>
                          {r.referrerOverdue && (
                            <span className={`${PILL} bg-[color-mix(in_srgb,var(--red)_16%,transparent)] text-red`}>
                              Overdue
                            </span>
                          )}
                          {r.referrerPending && (
                            <span className={`${PILL} bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-accent`}>
                              Pending
                            </span>
                          )}
                          {total > 0 && (
                            <span
                              className={`${PILL} ${
                                paidCount === total
                                  ? 'bg-[color-mix(in_srgb,var(--green)_16%,transparent)] text-green'
                                  : 'bg-[color-mix(in_srgb,var(--muted)_16%,transparent)] text-muted'
                              }`}
                            >
                              {paidCount}/{total} paid
                            </span>
                          )}
                        </span>
                        <span className="mt-1.5 flex items-center gap-x-2 gap-y-0.5 flex-wrap text-[12px] text-muted">
                          <span className="font-semibold text-text">
                            {r.referrerName}
                          </span>
                          <span className="text-faint">·</span>
                          <span className="break-all">{r.referrerEmail}</span>
                          <span className="text-faint">·</span>
                          <span>Commission {r.affiliatePercentage ?? 0}%</span>
                          <span className="text-faint">·</span>
                          <span className="font-mono text-text">
                            {fmtMoney(r.totalCommissionEarned)}
                          </span>
                          <span>earned</span>
                        </span>
                      </span>
                    </button>

                    <div className="flex-none flex items-center ml-auto">
                      {r.hasReleasable ? (
                        <Link
                          to={`/admin/referrals/release/${r.userUniId}`}
                          className="inline-flex items-center gap-[6px] rounded-pill py-2 px-3.5 text-[12px] font-bold bg-accent text-on-accent shadow-[0_8px_20px_var(--glow)] transition-[filter] duration-150 hover:brightness-[1.06]"
                        >
                          <Send size={12} />
                          Release Payment
                        </Link>
                      ) : r.hasReleased ? (
                        <span className="inline-flex items-center gap-[6px] text-[12px] font-bold text-green py-2">
                          <CheckCircle2 size={13} />
                          Payout Released!
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {open && <ExpandedBody referrer={r} onReload={onReload} />}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
