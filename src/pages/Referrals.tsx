import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Navigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  RefreshCw,
  Search,
  Table2,
} from 'lucide-react'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import DataState from '../components/dashboard/DataState'
import AffiliateKpiStrip from '../components/referrals/AffiliateKpiStrip'
import AffiliateHeroCard from '../components/referrals/AffiliateHeroCard'
import WalletWarningAlert from '../components/referrals/WalletWarningAlert'
import NetworkTable from '../components/referrals/NetworkTable'
import NetworkCardGrid from '../components/referrals/NetworkCardGrid'
import NetworkEmptyState from '../components/referrals/NetworkEmptyState'
import ReferralDetailsDialog from '../components/referrals/ReferralDetailsDialog'
import RemoveReferralDialog from '../components/referrals/RemoveReferralDialog'
import CommunitySetupDialog from '../components/referrals/CommunitySetupDialog'
import ReleasedPaymentsTable from '../components/referrals/ReleasedPaymentsTable'
import { useApiData } from '../hooks/useApiData'
import { useIsMobile } from '../hooks/useIsMobile'
import { getMyPayouts, getReferrals } from '../services/referrals'
import { getPayoutMethods } from '../services/payoutMethods'
import { ApiError } from '../services/api'
import type {
  MemberStatus,
  ReferralMember,
  ReleasedPayout,
} from '../types/referrals'

type Tab = 'network' | 'payments'
type StatusFilter = 'all' | MemberStatus
type View = 'table' | 'cards'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'new', label: 'New' },
  { value: 'suspended', label: 'Suspended' },
]

const TAB_BTN =
  'text-[12.5px] font-semibold py-[7px] px-4 rounded-btn cursor-pointer transition-colors duration-150'
const PAG_BTN =
  'grid place-items-center w-8 h-8 border border-border bg-surface2 text-text rounded-[9px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

export default function Referrals() {
  const { data, loading, error, reload } = useApiData(getReferrals)
  const methods = useApiData(getPayoutMethods)
  const isMobile = useIsMobile()

  const [tab, setTab] = useState<Tab>('network')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [view, setView] = useState<View>('table')
  const [page, setPage] = useState(1)

  const [details, setDetails] = useState<ReferralMember | null>(null)
  const [toRemove, setToRemove] = useState<ReferralMember | null>(null)
  const [communityOpen, setCommunityOpen] = useState(false)
  const communityPrompted = useRef(false)

  // Released payments — fetched lazily on first tab activation, kept across switches.
  const [payouts, setPayouts] = useState<ReleasedPayout[] | null>(null)
  const [payoutsLoading, setPayoutsLoading] = useState(false)
  const [payoutsError, setPayoutsError] = useState<unknown>(null)

  const loadPayouts = useCallback(async () => {
    setPayoutsLoading(true)
    setPayoutsError(null)
    try {
      setPayouts(await getMyPayouts())
    } catch (err) {
      setPayoutsError(err)
    } finally {
      setPayoutsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (
      tab === 'payments' &&
      payouts === null &&
      !payoutsLoading &&
      payoutsError === null
    ) {
      void loadPayouts()
    }
  }, [tab, payouts, payoutsLoading, payoutsError, loadPayouts])

  // Auto-open the community setup once per visit when a code exists but no profile.
  useEffect(() => {
    if (data && data.code && !data.community && !communityPrompted.current) {
      communityPrompted.current = true
      setCommunityOpen(true)
    }
  }, [data])

  const members = useMemo(() => data?.members ?? [], [data])

  const filtered = useMemo(() => {
    let list = members
    if (statusFilter !== 'all') list = list.filter((m) => m.status === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((m) => m.name.toLowerCase().includes(q))
    return list
  }, [members, statusFilter, search])

  const effectiveView: View = isMobile ? 'cards' : view
  const perPage = effectiveView === 'table' ? 8 : 6
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * perPage, safePage * perPage)

  const authError = [error, methods.error].find(
    (e) => e instanceof ApiError && e.status === 401,
  )
  if (authError) {
    return <Navigate to="/auth" replace />
  }

  if (!data) {
    return (
      <DashboardLayout title="Referrals">
        <DataState loading={loading} error={error} onRetry={reload} label="referrals" />
      </DashboardLayout>
    )
  }

  const wallets = methods.data?.wallets ?? []
  const bankAccounts = methods.data?.bankAccounts ?? []
  const hasNoPayoutMethods =
    methods.data != null && wallets.length === 0 && bankAccounts.length === 0

  const inviteLink = data.code
    ? `${window.location.origin}/auth?ref=${data.code}`
    : null

  const setFilter = (fn: () => void) => {
    fn()
    setPage(1)
  }

  const refreshAll = () => {
    reload()
    methods.reload()
    // Payouts refetch lazily the next time (or immediately if) the tab is active.
    setPayouts(null)
    setPayoutsError(null)
  }

  const networkBody =
    members.length === 0 ? (
      <NetworkEmptyState inviteLink={inviteLink} />
    ) : filtered.length === 0 ? (
      <div className="rounded-card border border-border bg-surface text-center text-muted text-[13px] py-[34px] px-6">
        No members match your filters.
      </div>
    ) : (
      <>
        {effectiveView === 'table' ? (
          <NetworkTable
            members={paginated}
            onView={setDetails}
            onRemove={setToRemove}
          />
        ) : (
          <NetworkCardGrid
            members={paginated}
            onView={setDetails}
            onRemove={setToRemove}
          />
        )}
        <div className="flex items-center justify-between flex-wrap gap-2.5 mt-4">
          <span className="text-[12px] text-faint">
            Showing {(safePage - 1) * perPage + 1}–
            {Math.min(safePage * perPage, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className={PAG_BTN}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-[12.5px] text-muted">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              className={PAG_BTN}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </>
    )

  return (
    <DashboardLayout title="Referrals">
      {/* Header */}
      <div
        className="flex items-start justify-between flex-wrap gap-4 mb-[22px]"
        data-aos="fade-up"
      >
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent mb-1.5">
            AFFILIATE
          </p>
          <h1 className="font-display text-[30px] font-extrabold tracking-[-0.02em] mb-1.5">
            Grow your network
          </h1>
          <p className="text-sm text-muted max-w-[560px]">
            Share your link, watch your community grow, and earn from every
            trade.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 border border-border bg-surface2 text-text py-[9px] px-4 rounded-pill text-[12.5px] font-semibold cursor-pointer transition-[border-color,color] duration-150 hover:border-accent hover:text-accent"
          onClick={refreshAll}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {hasNoPayoutMethods && <WalletWarningAlert />}

      <AffiliateKpiStrip
        stats={data.stats}
        affiliatePercentage={data.affiliatePercentage}
      />

      <AffiliateHeroCard
        data={data}
        wallets={wallets}
        bankAccounts={bankAccounts}
        methodsLoading={methods.loading}
        methodsError={methods.error}
        onCodeGenerated={reload}
        onEditCommunity={() => setCommunityOpen(true)}
        onMethodsChanged={methods.reload}
      />

      {/* Tabs */}
      <div
        className="flex items-center justify-between flex-wrap gap-3.5 mb-3.5"
        data-aos="fade-up"
        data-aos-delay="180"
      >
        <div
          className="inline-flex gap-1 p-1 border border-border rounded-[12px] bg-surface2"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'network'}
            className={`${TAB_BTN} ${
              tab === 'network'
                ? 'bg-accent text-on-accent'
                : 'bg-transparent text-muted hover:text-text'
            }`}
            onClick={() => setFilter(() => setTab('network'))}
          >
            Your network ({members.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'payments'}
            className={`${TAB_BTN} ${
              tab === 'payments'
                ? 'bg-accent text-on-accent'
                : 'bg-transparent text-muted hover:text-text'
            }`}
            onClick={() => setFilter(() => setTab('payments'))}
          >
            Released payments
          </button>
        </div>

        {tab === 'network' && members.length > 0 && (
          <div className="flex items-center gap-2.5 flex-wrap">
            <label className="flex items-center gap-2 border border-border rounded-[12px] bg-surface2 px-3 text-muted">
              <Search size={14} className="flex-none" />
              <input
                type="search"
                placeholder="Search by name…"
                value={search}
                onChange={(e) => setFilter(() => setSearch(e.target.value))}
                className="w-[150px] h-9 border-none outline-none bg-transparent text-text text-[13px] font-body"
                aria-label="Search members by name"
              />
            </label>
            <select
              className="h-9 border border-border rounded-[12px] bg-surface2 text-text px-3 text-[12.5px] font-body cursor-pointer"
              value={statusFilter}
              onChange={(e) =>
                setFilter(() => setStatusFilter(e.target.value as StatusFilter))
              }
              aria-label="Filter by status"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {!isMobile && (
              <div
                className="inline-flex gap-1 p-1 border border-border rounded-[12px] bg-surface2"
                role="group"
                aria-label="View"
              >
                <button
                  type="button"
                  className={`grid place-items-center w-8 h-7 rounded-[8px] cursor-pointer transition-colors duration-150 ${
                    view === 'table'
                      ? 'bg-accent text-on-accent'
                      : 'bg-transparent text-muted hover:text-text'
                  }`}
                  onClick={() => setFilter(() => setView('table'))}
                  title="Table view"
                  aria-label="Table view"
                  aria-pressed={view === 'table'}
                >
                  <Table2 size={14} />
                </button>
                <button
                  type="button"
                  className={`grid place-items-center w-8 h-7 rounded-[8px] cursor-pointer transition-colors duration-150 ${
                    view === 'cards'
                      ? 'bg-accent text-on-accent'
                      : 'bg-transparent text-muted hover:text-text'
                  }`}
                  onClick={() => setFilter(() => setView('cards'))}
                  title="Card view"
                  aria-label="Card view"
                  aria-pressed={view === 'cards'}
                >
                  <LayoutGrid size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Switched region — re-mounts on tab/filter/view/page change (search excluded) */}
      <div
        key={`${tab}-${statusFilter}-${effectiveView}-${safePage}`}
        className="animate-[fadeup_0.35s_ease-out]"
      >
        {tab === 'network' ? (
          networkBody
        ) : (
          <ReleasedPaymentsTable
            payouts={payouts}
            loading={payoutsLoading}
            error={payoutsError}
            onRetry={() => void loadPayouts()}
          />
        )}
      </div>

      {/* Dialogs */}
      <ReferralDetailsDialog member={details} onClose={() => setDetails(null)} />
      <RemoveReferralDialog
        member={toRemove}
        onCancel={() => setToRemove(null)}
        onRemoved={() => {
          setToRemove(null)
          reload()
        }}
      />
      <CommunitySetupDialog
        open={communityOpen}
        community={data.community}
        onClose={() => setCommunityOpen(false)}
        onSaved={() => {
          setCommunityOpen(false)
          reload()
        }}
      />
    </DashboardLayout>
  )
}
