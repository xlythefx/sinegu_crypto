import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Search, Tags } from 'lucide-react'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import DataState from '../components/dashboard/DataState'
import AssetPerformanceCard from '../components/asset-performance/AssetPerformanceCard'
import { useApiData } from '../hooks/useApiData'
import { getAssetPerformance } from '../services/dashboard'
import { ApiError } from '../services/api'
import { displaySymbol } from '../lib/chart'
import './AssetPerformance.css'

const PAGE_SIZE = 9

export default function AssetPerformance() {
  const { data, loading, error, reload } = useApiData(getAssetPerformance)

  const [search, setSearch] = useState('')
  const [assetFilter, setAssetFilter] = useState('all')
  const [page, setPage] = useState(1)

  const assets = useMemo(() => data?.assets ?? [], [data])

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

  if (!data) {
    return (
      <DashboardLayout title="Asset Performance">
        <DataState
          loading={loading}
          error={error}
          onRetry={reload}
          label="asset performance"
        />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Asset Performance">
      <div className="aperf-head" data-aos="fade-up">
        <div>
          <p className="aperf-head__kicker mono">PER-ASSET ANALYTICS</p>
          <h1 className="aperf-head__title">Asset Performance</h1>
          <p className="aperf-head__sub">
            Every asset you've traded, ranked by total P&L — with win rates,
            drawdowns and equity curves.
          </p>
        </div>
      </div>

      {assets.length === 0 ? (
        <div className="dcard aperf-empty" data-aos="fade-up">
          No closed trades by asset yet. Trade on your connected brokers to see
          performance here.
        </div>
      ) : (
        <>
          <div className="dcard aperf-filter" data-aos="fade-up">
            <label className="aperf-filter__search">
              <Search size={15} />
              <input
                type="search"
                placeholder="Search by ticker or name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search assets"
              />
            </label>
            <label className="aperf-filter__select">
              <Tags size={14} />
              <select
                value={assetFilter}
                onChange={(e) => setAssetFilter(e.target.value)}
                aria-label="Filter by asset"
              >
                <option value="all">All assets</option>
                {assets.map((a) => (
                  <option key={a.ticker} value={a.ticker}>
                    {displaySymbol(a.ticker)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filtered.length === 0 ? (
            <p className="aperf-nomatch">
              No assets match your search or filter.
            </p>
          ) : (
            <div className="aperf-grid">
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
            <div className="aperf-pag">
              <span className="aperf-pag__info">
                Showing {start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)}{' '}
                of {filtered.length}
                {filtered.length !== assets.length &&
                  ` (filtered from ${assets.length})`}
              </span>
              {totalPages > 1 && (
                <div className="aperf-pag__controls">
                  <button
                    type="button"
                    className="aperf-pag__btn"
                    disabled={safePage === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={14} />
                    Previous
                  </button>
                  <span className="aperf-pag__page">
                    Page {safePage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    className="aperf-pag__btn"
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
