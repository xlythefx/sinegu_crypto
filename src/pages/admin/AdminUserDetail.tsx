import { useCallback, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BarChart3, ImageDown, LayoutDashboard, Wallet, type LucideIcon } from 'lucide-react'
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
import UserHeaderActions from '../../components/admin/user-detail/UserHeaderActions'
import UserPositionsTab from '../../components/admin/user-detail/UserPositionsTab'
import AnalyticsView from '../../components/analytics/AnalyticsView'
import PnlCardModal from '../../components/admin/pnl-card/PnlCardModal'
import { EXCHANGE_META } from '../../components/exchanges/meta'
import { useApiData } from '../../hooks/useApiData'
import { useSessionUser } from '../../hooks/useSessionUser'
import { isCollaborator } from '../../lib/roles'
import {
  getAdminUserDailyPnl,
  getAdminUserDetail,
  getAdminUserSummary,
} from '../../services/admin'
import { ApiError } from '../../services/api'
import { getAdminUserAnalytics, type AnalyticsFilters } from '../../services/analytics'

const BACK_BTN =
  'inline-flex items-center gap-[7px] py-2 px-[13px] border border-border rounded-field bg-surface text-muted text-[13px] font-semibold cursor-pointer transition-colors hover:bg-accent-soft hover:border-accent-line hover:text-accent'
const CARD_BTN =
  'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-btn border border-accent-line bg-accent-soft text-accent text-[12.5px] font-semibold cursor-pointer transition-colors hover:bg-accent hover:text-on-accent disabled:opacity-50 disabled:cursor-not-allowed'
const TAB_BTN =
  'inline-flex items-center gap-1.5 text-[12.5px] font-semibold py-[7px] px-4 rounded-btn cursor-pointer transition-colors duration-150'

type Tab = 'overview' | 'positions' | 'analytics'

const TABS: { key: Tab; label: string; Icon: LucideIcon }[] = [
  { key: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { key: 'positions', label: 'Positions', Icon: Wallet },
  { key: 'analytics', label: 'Performance Analytics', Icon: BarChart3 },
]

/** A read-only collaborator never sees Positions (the API 403s it). */
const COLLABORATOR_TABS: readonly Tab[] = ['overview', 'analytics']

/**
 * Admin drill-down into one user: Overview stats, Positions, and the user's
 * full Performance Analytics (the same `AnalyticsView` the trader sees, read
 * through the admin endpoint, with a PNG download on every card).
 *
 * A read-only collaborator gets Overview + Performance Analytics only, and the
 * Overview without the cards whose reads they may not make (exchange
 * accounts, invoices, referrals, fees/suspend) — those are not rendered at
 * all, so their requests never fire.
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
  const readOnly = isCollaborator(useSessionUser()?.type)
  const tabs = readOnly ? TABS.filter((t) => COLLABORATOR_TABS.includes(t.key)) : TABS

  const [tab, setTab] = useState<Tab>('overview')
  const [exchange, setExchange] = useState<ExchangePillValue>('all')
  const [cardOpen, setCardOpen] = useState(false)
  // Bumped by the header's Refresh / status actions: every fetcher below
  // depends on it, so one bump re-reads the whole page (calendar included).
  const [version, setVersion] = useState(0)
  const rereadAll = useCallback(() => setVersion((v) => v + 1), [])

  // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` is the re-read trigger
  const fetchDetail = useCallback(() => getAdminUserDetail(uniId), [uniId, version])
  const fetchSummary = useCallback(
    () => getAdminUserSummary(uniId, exchange),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` is the re-read trigger
    [uniId, exchange, version],
  )
  const fetchDays = useCallback(
    () => getAdminUserDailyPnl(uniId, exchange),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` is the re-read trigger
    [uniId, exchange, version],
  )

  const { data: user, loading, error, reload } = useApiData(fetchDetail, [
    fetchDetail,
  ])
  const { data: summary, loading: summaryLoading } = useApiData(fetchSummary, [
    fetchSummary,
  ])
  const { data: days } = useApiData(fetchDays, [fetchDays])
  const fetchAnalytics = useCallback(
    (query: AnalyticsFilters) => getAdminUserAnalytics(uniId, query),
    [uniId],
  )

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  const back = () => navigate('/admin/users')

  // Suspended AND nothing connected: every stat below is an empty zero, so the
  // cards are greyed out rather than reading like a real $0.00 account. A
  // collaborator's payload has no account list, so this needs `accounts`.
  const dormant =
    !!user &&
    user.status === 'suspended' &&
    user.accounts !== undefined &&
    !user.accounts.some((a) => !a.deleted_at)

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
      <div className="mb-3.5 flex flex-wrap items-start justify-between gap-3">
        <button type="button" className={BACK_BTN} onClick={back}>
          <ArrowLeft size={16} /> Back to Users
        </button>
        {!readOnly && <UserHeaderActions user={user} onChanged={rereadAll} />}
      </div>

      <UserProfileHeader user={user} referralsCount={user.referrals_count} />

      {/* tab row + shared exchange filter */}
      <div
        className="mb-stack flex flex-wrap items-center justify-between gap-3"
        data-aos="fade-up"
        data-aos-delay="100"
      >
        <div
          className="inline-flex max-w-full flex-wrap gap-1 rounded-[12px] border border-border bg-surface p-1"
          role="tablist"
        >
          {tabs.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`${TAB_BTN} ${
                tab === key
                  ? 'bg-accent text-on-accent'
                  : 'bg-transparent text-muted hover:text-text'
              }`}
              onClick={() => setTab(key)}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Every staff role, collaborators included: a shareable, name-free,
              percentage-only card built from the calendar days below. */}
          <button
            type="button"
            className={CARD_BTN}
            onClick={() => setCardOpen(true)}
            disabled={!days}
          >
            <ImageDown size={15} />
            P&L card
          </button>
          {/* Analytics carries its own exchange filter inside the view. */}
          {tab !== 'analytics' && (
            <ExchangeFilterPill value={exchange} onChange={setExchange} />
          )}
        </div>
      </div>

      <PnlCardModal
        open={cardOpen}
        onClose={() => setCardOpen(false)}
        days={days ?? {}}
        venue={exchange === 'all' ? null : EXCHANGE_META[exchange].label}
      />

      <div data-aos="fade-up" data-aos-delay="150">
        {/* keyed re-mount replays the reveal on every tab / filter switch */}
        <div
          key={tab === 'analytics' ? tab : `${tab}-${exchange}`}
          className="animate-[fadeup_0.35s_ease-out]"
        >
          {tab === 'overview' ? (
            <>
              {dormant && (
                <p className="mb-3 rounded-[10px] border border-dashed border-border bg-surface2 px-3.5 py-2.5 text-[12.5px] text-muted">
                  Suspended, with no exchange account connected — these stats have nothing to measure.
                </p>
              )}
              <div
                className={dormant ? 'pointer-events-none select-none opacity-45 grayscale' : ''}
                aria-disabled={dormant || undefined}
              >
                <UserBalanceCard summary={summary} loading={summaryLoading} />

                <div
                  className={`grid gap-stack mb-stack max-[1100px]:grid-cols-1 ${
                    readOnly ? 'grid-cols-2' : 'grid-cols-3 max-[1500px]:grid-cols-2'
                  }`}
                >
                  {!readOnly && (
                    <UserAccountCards accounts={user.accounts ?? []} exchange={exchange} />
                  )}
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
              </div>

              {!readOnly && (
                <>
                  <div className="grid grid-cols-2 gap-stack mb-stack max-[1100px]:grid-cols-1">
                    <UserInvoicesTable uniId={uniId} exchange={exchange} />
                    <UserReferralsTable uniId={uniId} />
                  </div>

                  <UserSettingsCard user={user} onUpdated={reload} />
                </>
              )}
            </>
          ) : tab === 'analytics' ? (
            <AnalyticsView
              fetchAnalytics={fetchAnalytics}
              sourceKey={uniId}
              showStrategyCard={false}
              capture={{ name: user.name || uniId }}
            />
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
