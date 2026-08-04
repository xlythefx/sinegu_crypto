import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Search, Tags } from 'lucide-react'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import DataState from '../components/dashboard/DataState'
import AssetPerformanceCard from '../components/asset-performance/AssetPerformanceCard'
import TradableAssetsShowcase from '../components/asset-performance/TradableAssetsShowcase'
import { useApiData } from '../hooks/useApiData'
import { getAssetPerformance } from '../services/dashboard'
import { getTradableAssets } from '../services/assets'
import { ApiError } from '../services/api'
import { displaySymbol } from '../lib/chart'

const PAGE_SIZE = 9

const PAG_BTN =
  'inline-flex items-center gap-[5px] border border-border bg-surface2 text-text rounded-pill py-2 px-4 text-[12.5px] font-semibold cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed enabled:hover:border-accent'

export default function AssetPerformance() {
  const { data, loading, error, reload } = useApiData(getAssetPerformance)
  const catalog = useApiData(getTradableAssets)

  const [search, setSearch] = useState('')
  const [assetFilter, setAssetFilter] = useState('all')
  const [page, setPage] = useState(1)

  const assets = useMemo(() => data?.assets ?? [], [data])

  /** Tickers with closed trades — marks the showcase tiles already traded. */
  const tradedTickers = useMemo(
    () => new Set(assets.map((a) => a.ticker)),
    [assets]
  )

  // Ranks follow the API's P&L ordering, independent of search/filter
  const rankByTicker = useMemo(() => {
    const m = new Map<string, number>()
    assets.forEach((a, i) => m.set(a.ticker, i + 1))
    return m
  }, [assets])

  const filtered = useMemo(() => {
    let list = assets
    if (assetFilter !== 'all') list = list.filter((a) => a.ticker === assetFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (a) =>
          a.ticker.toLowerCase().includes(q) ||
          displaySymbol(a.ticker).toLowerCase().includes(q)
      )
    }
    return list
  }, [assets, assetFilter, search])

  useEffect(() => {
    setPage(1)
  }, [search, assetFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const pageRows = filtered.slice(start, start + PAGE_SIZE)

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  return (
    <DashboardLayout title="Asset Performance">
      <div className="mb-[22px]" data-aos="fade-up">
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-accent mb-1.5">
            PER-ASSET ANALYTICS
          </p>
          <h1 className="font-display text-[30px] font-extrabold tracking-[-0.02em] mb-1.5">
            Asset Performance
          </h1>
          <p className="text-[14px] text-muted max-w-[520px]">
            Every asset you've traded, ranked by total P&L — with win rates,
            drawdowns and equity curves.
          </p>
        </div>
      </div>

      <TradableAssetsShowcase
        assets={catalog.data}
        loading={catalog.loading}
        error={catalog.error}
        onRetry={catalog.reload}
        tradedTickers={tradedTickers}
      />

      <div className="mb-3.5" data-aos="fade-up">
        <h2 className="font-display text-[20px] font-extrabold tracking-[-0.01em]">
          Your performance by asset
        </h2>
        <p className="mt-1 max-w-[520px] text-[13px] text-muted">
          Built from your closed trades, ranked by total P&L.
        </p>
      </div>

      {!data ? (
        <DataState
          loading={loading}
          error={error}
          onRetry={reload}
          label="asset performance"
        />
      ) : assets.length === 0 ? (
        <div
          className="rounded-card border border-dashed border-border bg-surface py-12 px-6 text-center text-muted text-[14px]"
          data-aos="fade-up"
        >
          No closed trades by asset yet. Trade on your connected brokers to see
          performance here.
        </div>
      ) : (
        <>
          <div
            className="rounded-card border border-border bg-surface flex flex-wrap gap-3 items-center justify-between py-3.5 px-[18px] mb-[22px]"
            data-aos="fade-up"
          >
            <label className="flex items-center gap-[9px] flex-1 min-w-[220px] max-w-[420px] border border-border rounded-row bg-surface2 px-3.5 text-muted">
              <Search size={15} />
              <input
                type="search"
                className="flex-1 h-[42px] border-0 outline-none bg-transparent text-text text-[13.5px] font-body"
                placeholder="Search by ticker or name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search assets"
              />
            </label>
            <label className="flex items-center gap-2 border border-border rounded-row bg-surface2 px-3 text-muted">
              <Tags size={14} />
              <select
                className="h-[42px] border-0 outline-none bg-transparent text-text text-[13.5px] font-body cursor-pointer min-w-[170px]"
                value={assetFilter}
                onChange={(e) => setAssetFilter(e.target.value)}
                aria-label="Filter by asset"
              >
                <option className="bg-surface text-text" value="all">
                  All assets
                </option>
                {assets.map((a) => (
                  <option key={a.ticker} className="bg-surface text-text" value={a.ticker}>
                    {displaySymbol(a.ticker)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filtered.length === 0 ? (
            <p className="text-center text-muted text-[14px] py-10">
              No assets match your search or filter.
            </p>
          ) : (
            /* key on the filter/search/page signature re-mounts the grid so it
               replays the fade-slide reveal every time the results change. */
            <div
              key={`${assetFilter}-${search}-${safePage}`}
              className="grid grid-cols-3 gap-[18px] max-[1200px]:grid-cols-2 max-[760px]:grid-cols-1 animate-[fadeup_0.35s_ease-out]"
            >
              {pageRows.map((asset) => (
                <AssetPerformanceCard
                  key={asset.ticker}
                  asset={asset}
                  rank={rankByTicker.get(asset.ticker) ?? 0}
                  balance={data.balance}
                />
              ))}
            </div>
          )}

          {filtered.length > 0 && (
            <div className="flex flex-col items-center gap-2.5 mt-6 pt-4 border-t border-hair">
              <span className="text-[12px] text-faint">
                Showing {start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)}{' '}
                of {filtered.length}
                {filtered.length !== assets.length &&
                  ` (filtered from ${assets.length})`}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className={PAG_BTN}
                    disabled={safePage === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={14} />
                    Previous
                  </button>
                  <span className="text-[12.5px] text-muted">
                    Page {safePage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    className={PAG_BTN}
                    disabled={safePage === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  )
}
