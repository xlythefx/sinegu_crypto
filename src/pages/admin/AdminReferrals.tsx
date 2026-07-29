import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import AffiliateStatCards from '../../components/admin/referrals/AffiliateStatCards'
import ReferrerAccordion from '../../components/admin/referrals/ReferrerAccordion'
import LedgerTable from '../../components/admin/referrals/LedgerTable'
import { useApiData } from '../../hooks/useApiData'
import {
  getAffiliateOverview,
  getLedgerStats,
} from '../../services/adminReferrals'
import { ApiError } from '../../services/api'
import type { AdminReferrer, LedgerStats } from '../../types/referrals'

type Tab = 'overview' | 'ledger'

interface AffiliateData {
  referrers: AdminReferrer[]
  ledgerStats: LedgerStats
}

async function fetchAffiliateData(): Promise<AffiliateData> {
  const [referrers, ledgerStats] = await Promise.all([
    getAffiliateOverview(),
    getLedgerStats(),
  ])
  return { referrers, ledgerStats }
}

const TAB_BTN =
  'text-[12.5px] font-semibold py-[7px] px-4 rounded-btn cursor-pointer transition-colors duration-150'

/** Admin affiliate console — stat cards + Overview / Ledger tabs. */
export default function AdminReferrals() {
  const { data, loading, error, reload } = useApiData(fetchAffiliateData)
  const [tab, setTab] = useState<Tab>('overview')

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  if (!data) {
    return (
      <AdminLayout title="Affiliate" subtitle="Referrers, referrals, and payout ledger.">
        <DataState loading={loading} error={error} onRetry={reload} label="affiliate data" />
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Affiliate" subtitle="Referrers, referrals, and payout ledger.">
      <AffiliateStatCards referrers={data.referrers} ledgerStats={data.ledgerStats} />

      <div
        className="inline-flex gap-1 p-1 border border-border rounded-[12px] bg-surface2 mb-[14px]"
        role="tablist"
        data-aos="fade-up"
        data-aos-delay="100"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'overview'}
          className={`${TAB_BTN} ${
            tab === 'overview'
              ? 'bg-accent text-on-accent'
              : 'bg-transparent text-muted hover:text-text'
          }`}
          onClick={() => setTab('overview')}
        >
          Affiliate overview ({data.referrers.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'ledger'}
          className={`${TAB_BTN} ${
            tab === 'ledger'
              ? 'bg-accent text-on-accent'
              : 'bg-transparent text-muted hover:text-text'
          }`}
          onClick={() => setTab('ledger')}
        >
          Ledger ({data.ledgerStats.totalSentCount})
        </button>
      </div>

      {/* keyed so switching tabs replays the reveal instead of a hard cut */}
      <div key={tab} className="animate-[fadeup_0.35s_ease-out]">
        {tab === 'overview' ? (
          <ReferrerAccordion referrers={data.referrers} onReload={reload} />
        ) : (
          <LedgerTable />
        )}
      </div>
    </AdminLayout>
  )
}
