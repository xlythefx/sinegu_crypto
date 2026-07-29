import { Clock, DollarSign, Percent, UserCheck, Users } from 'lucide-react'
import { fmtMediumDate, fmtMoney } from '../../lib/format'
import type { ReferralStats } from '../../types/referrals'

interface AffiliateKpiStripProps {
  stats: ReferralStats
  affiliatePercentage: number | null
}

const ICON =
  'w-[42px] h-[42px] flex-shrink-0 grid place-items-center rounded-[12px] border bg-surface2 border-border text-muted'

/**
 * The 5 affiliate KPI tiles. Every figure is server-computed
 * (ReferralsData.stats) — this component only formats and renders.
 */
export default function AffiliateKpiStrip({
  stats,
  affiliatePercentage,
}: AffiliateKpiStripProps) {
  const activation =
    stats.totalReferrals > 0
      ? Math.round((stats.activeReferrals / stats.totalReferrals) * 100)
      : 0

  const tiles = [
    {
      key: 'total',
      icon: Users,
      label: 'Total referrals',
      value: String(stats.totalReferrals),
      hint: `${stats.activeReferrals} active`,
    },
    {
      key: 'active',
      icon: UserCheck,
      label: 'Active members',
      value: String(stats.activeReferrals),
      hint: `${activation}% activation`,
    },
    {
      key: 'lifetime',
      icon: DollarSign,
      label: 'Lifetime earnings',
      value: fmtMoney(stats.lifetimeEarnings),
      hint: stats.lastPayoutAt
        ? `Last payout ${fmtMediumDate(stats.lastPayoutAt)}`
        : 'No payouts yet',
    },
    {
      key: 'pending',
      icon: Clock,
      label: 'Pending payout',
      value: fmtMoney(stats.pendingPayout),
      hint:
        stats.projectedCommission > 0
          ? `+${fmtMoney(stats.projectedCommission)} projected`
          : 'Awaiting release',
    },
    {
      key: 'commission',
      icon: Percent,
      label: 'Commission',
      value: affiliatePercentage != null ? `${affiliatePercentage}%` : '—',
      hint: 'Your current rate',
    },
  ]

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-4"
      data-aos="fade-up"
    >
      {tiles.map((t, i) => (
        <div
          key={t.key}
          className="rounded-card border border-border bg-surface p-4 flex items-center gap-3"
          data-aos="fade-up"
          data-aos-delay={i * 60}
        >
          <span className={ICON}>
            <t.icon size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-[10.5px] uppercase tracking-[0.08em] text-faint mb-1 overflow-hidden text-ellipsis whitespace-nowrap">
              {t.label}
            </p>
            <p className="text-[19px] font-bold text-text leading-[1.1] font-mono">
              {t.value}
            </p>
            <p className="text-[11.5px] text-muted mt-[3px] overflow-hidden text-ellipsis whitespace-nowrap">
              {t.hint}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
