import { useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, History, Layers, TrendingUpDown, X } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import AssetHistoryTab from '../../components/admin/assets/AssetHistoryTab'
import AssetsTab from '../../components/admin/assets/AssetsTab'
import ExchangeSwitcher from '../../components/admin/assets/ExchangeSwitcher'
import StreakSizingTab from '../../components/admin/assets/StreakSizingTab'
import {
  countByExchange,
  parseExchangeFilter,
  type ExchangeFilter,
} from '../../components/admin/assets/exchangeGroups'
import Tabs, { type TabItem } from '../../components/ui/Tabs'
import { useApiData } from '../../hooks/useApiData'
import { useTradedExchanges } from '../../hooks/useTradedExchanges'
import { getAdminAssets } from '../../services/admin'

type TabKey = 'assets' | 'streak-sizing' | 'history'

const TABS: TabItem<TabKey>[] = [
  { key: 'assets', label: 'Assets', Icon: Layers },
  { key: 'streak-sizing', label: 'Streak Sizing Settings', Icon: TrendingUpDown },
  { key: 'history', label: 'Change history', Icon: History },
]

/**
 * `?tab=` values that open the streak tab. `loss-sizing` is its name from
 * before win steps existed — the owner's to-do link and bookmarks still
 * carry it, so it must keep landing here.
 */
const STREAK_TAB_PARAMS = new Set(['streak-sizing', 'loss-sizing'])

export default function AdminAssets() {
  const { data: assets, loading, error, reload } = useApiData(getAdminAssets)
  const traded = useTradedExchanges()

  // Tab and exchange live in the URL (`?tab=`, `?exchange=`) so a link or a
  // reload lands on the same view; defaults omit their param. The exchange is
  // shared by both tabs, so switching tabs keeps the venue picked.
  const [params, setParams] = useSearchParams()
  const tab: TabKey = STREAK_TAB_PARAMS.has(params.get('tab') ?? '')
    ? 'streak-sizing'
    : params.get('tab') === 'history'
      ? 'history'
      : 'assets'
  const exchange = parseExchangeFilter(params.get('exchange'))

  const setParam = (key: 'tab' | 'exchange', value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === null) next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )
  const selectTab = (next: TabKey) => setParam('tab', next === 'assets' ? null : next)
  const selectExchange = (next: ExchangeFilter) =>
    setParam('exchange', next === 'all' ? null : next)

  // "LTCUSDT on Binance saved." — handed over by the New / Edit coin page.
  const location = useLocation()
  const navigate = useNavigate()
  const saved = (location.state as { saved?: string } | null)?.saved ?? null
  const dismissSaved = () =>
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null })

  const list = useMemo(() => assets ?? [], [assets])
  const counts = useMemo(() => countByExchange(list), [list])

  return (
    <AdminLayout title="Trading Assets" subtitle="Manage tradable instruments">
      {saved && (
        <div
          className="mb-stack flex items-center gap-3 rounded-row border border-[color-mix(in_srgb,var(--green)_35%,transparent)] bg-[color-mix(in_srgb,var(--green)_8%,transparent)] py-2 pl-3.5 pr-2 animate-[fadeup_0.35s_ease-out]"
          role="status"
        >
          <CheckCircle2 size={16} className="flex-none text-green" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13px] font-semibold text-text">{saved}</p>
          <button
            type="button"
            onClick={dismissSaved}
            className="inline-flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-btn text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
            aria-label="Dismiss"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="mb-stack flex flex-col gap-3">
        <Tabs tabs={TABS} active={tab} onChange={selectTab} label="Trading assets sections" />
        {assets && (
          <ExchangeSwitcher
            value={exchange}
            onChange={selectExchange}
            counts={counts}
            total={list.length}
          />
        )}
      </div>

      {!assets ? (
        <DataState loading={loading} error={error} onRetry={reload} label="assets" />
      ) : (
        // Keyed by tab only: the replay on a tab switch. Exchange and filter
        // switches re-key inside each tab, below its toolbar, so the search
        // box keeps focus and the streak drafts survive.
        <div key={tab} className="animate-[fadeup_0.35s_ease-out]">
          {tab === 'streak-sizing' ? (
            <StreakSizingTab
              assets={list}
              exchange={exchange}
              traded={traded}
              onSaved={reload}
            />
          ) : tab === 'history' ? (
            <AssetHistoryTab exchange={exchange} />
          ) : (
            <AssetsTab assets={list} exchange={exchange} traded={traded} onChanged={reload} />
          )}
        </div>
      )}
    </AdminLayout>
  )
}
