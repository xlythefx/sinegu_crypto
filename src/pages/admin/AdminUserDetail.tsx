import { useCallback, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, LayoutDashboard, Wallet } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import AdminPnlCalendar from '../../components/admin/AdminPnlCalendar'
import ExchangeFilterPill, {
  type ExchangePillValue,
} from '../../components/admin/user-detail/ExchangeFilterPill'
import UserProfileHeader from '../../components/admin/user-detail/UserProfileHeader'
import UserBalanceCard from '../../components/admin/user-detail/UserBalanceCard'
import UserAccountCards from '../../components/admin/user-detail/UserAccountCards'
import UserPerformanceMetrics from '../../components/admin/user-detail/UserPerformanceMetrics'
import UserCapitalFlow from '../../components/admin/user-detail/UserCapitalFlow'
import UserPerformanceChart from '../../components/admin/user-detail/UserPerformanceChart'
import UserInvoicesTable from '../../components/admin/user-detail/UserInvoicesTable'
import UserReferralsTable from '../../components/admin/user-detail/UserReferralsTable'
import UserSettingsCard from '../../components/admin/user-detail/UserSettingsCard'
import UserPositionsTab from '../../components/admin/user-detail/UserPositionsTab'
import { useApiData } from '../../hooks/useApiData'
import {
  getAdminUserDailyPnl,
  getAdminUserDetail,
  getAdminUserSummary,
} from '../../services/admin'
import { ApiError } from '../../services/api'

const BACK_BTN =
  'inline-flex items-center gap-[7px] mb-3.5 py-2 px-[13px] border border-border rounded-field bg-surface text-muted text-[13px] font-semibold cursor-pointer transition-colors hover:bg-accent-soft hover:border-accent-line hover:text-accent'
const TAB_BTN =
  'inline-flex items-center gap-1.5 text-[12.5px] font-semibold py-[7px] px-4 rounded-btn cursor-pointer transition-colors duration-150'

type Tab = 'overview' | 'positions'

/**
 * Admin drill-down into one user: Overview stats + Positions.
 *
 * The exchange pill is the page's DATA SCOPE, not a display filter: it goes
 * to the API as `?exchange=` on every read (summary, calendar, positions,
 * invoices), so "MEXC" shows exactly what the user sees under their own MEXC
 * pill — equity, P&L, calendar and invoices all narrowed to that venue's
 * accounts and tables, never one card filtered beside another still pooling
 * every exchange. Only the account cards filter client-side: the profile
 * read returns every account (disconnected ones too) and the cards just pick
 * the venue's.
 */
export default function AdminUserDetail() {
  const { uniId = '' } = useParams<{ uniId: string }>()
  const navigate = useNavigate()

  const [tab, setTab] = useState<Tab>('overview')
  const [exchange, setExchange] = useState<ExchangePillValue>('all')

  const fetchDetail = useCallback(() => getAdminUserDetail(uniId), [uniId])
  const fetchSummary = useCallback(
    () => getAdminUserSummary(uniId, exchange),
    [uniId, exchange],
  )
  const fetchDays = useCallback(
    () => getAdminUserDailyPnl(uniId, exchange),
    [uniId, exchange],
  )

  const { data: user, loading, error, reload } = useApiData(fetchDetail, [
    fetchDetail,
  ])
  const { data: summary, loading: summaryLoading } = useApiData(fetchSummary, [
    fetchSummary,
  ])
  const { data: days } = useApiData(fetchDays, [fetchDays])

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  const back = () => navigate('/admin/users')

  if (!user) {
    return (
      <AdminLayout title="User Details" subtitle="Individual statistics.">
        <DataState loading={loading} error={error} onRetry={reload} label="user" />
      </AdminLayout>
    )
  }

  return (
    <AdminLayout
      title="User Details"
      subtitle={user.name || 'Individual statistics.'}
    >
      <button type="button" className={BACK_BTN} onClick={back}>
        <ArrowLeft size={16} /> Back to Users
      </button>

      <UserProfileHeader user={user} referralsCount={user.referrals_count} />

      {/* tab row + shared exchange filter */}
      <div
        className="mb-stack flex flex-wrap items-center justify-between gap-3"
        data-aos="fade-up"
        data-aos-delay="100"
      >
        <div
          className="inline-flex gap-1 rounded-[12px] border border-border bg-surface p-1"
          role="tablist"
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
            <LayoutDashboard size={13} />
            Overview
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'positions'}
            className={`${TAB_BTN} ${
              tab === 'positions'
                ? 'bg-accent text-on-accent'
                : 'bg-transparent text-muted hover:text-text'
            }`}
            onClick={() => setTab('positions')}
          >
            <Wallet size={13} />
            Positions
          </button>
        </div>
        <ExchangeFilterPill value={exchange} onChange={setExchange} />
      </div>

      <div data-aos="fade-up" data-aos-delay="150">
        {/* keyed re-mount replays the reveal on every tab / filter switch */}
        <div
          key={`${tab}-${exchange}`}
          className="animate-[fadeup_0.35s_ease-out]"
        >
          {tab === 'overview' ? (
            <>
              <UserBalanceCard summary={summary} loading={summaryLoading} />

              <div className="grid grid-cols-3 gap-stack mb-stack max-[1500px]:grid-cols-2 max-[1100px]:grid-cols-1">
                <UserAccountCards accounts={user.accounts} exchange={exchange} />
                <UserPerformanceMetrics
                  summary={summary}
                  loading={summaryLoading}
                />
                <UserCapitalFlow summary={summary} loading={summaryLoading} />
              </div>

              <div className="mb-stack">
                <UserPerformanceChart
                  days={days ?? {}}
                  initialDeposit={summary?.capital_flow.initial_deposit ?? 0}
                />
              </div>

              <div className="mb-stack">
                <AdminPnlCalendar
                  fetchDays={fetchDays}
                  subtitle={`Daily results for ${user.name || 'this user'} · click a day for its trades`}
                  aosDelay={0}
                />
              </div>

              <div className="grid grid-cols-2 gap-stack mb-stack max-[1100px]:grid-cols-1">
                <UserInvoicesTable uniId={uniId} exchange={exchange} />
                <UserReferralsTable uniId={uniId} />
              </div>

              <UserSettingsCard user={user} onUpdated={reload} />
            </>
          ) : (
            <UserPositionsTab
              uniId={uniId}
              exchange={exchange}
              summary={summary}
            />
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
