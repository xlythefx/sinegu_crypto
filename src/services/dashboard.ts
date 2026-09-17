import { apiFetch } from './api'
import { exchangeQuery, type ExchangeFilter } from '../context/ExchangeFilterContext'
import type {
  AssetPerformanceData,
  DailyPnlMap,
  DashboardSummary,
  OpenPosition,
  PastPosition,
} from '../types/dashboard'

// Every read takes the top-bar exchange filter: omitted / 'all' pools every
// connected exchange, a venue narrows the API's queries to that venue's own
// tables. The API answers 400 for a venue it has no tables for (Bybit), which
// the pills never offer.

export async function getDashboardSummary(
  exchange: ExchangeFilter = 'all',
): Promise<DashboardSummary> {
  const res = await apiFetch<{ success: boolean; summary: DashboardSummary }>(
    `/dashboard/summary${exchangeQuery(exchange)}`,
    { auth: true },
  )
  // PHP serializes an empty keyed collection as [] — normalize to an object
  if (Array.isArray(res.summary.daily_pnl)) res.summary.daily_pnl = {}
  return res.summary
}

export async function getDashboardDailyPnl(
  exchange: ExchangeFilter = 'all',
): Promise<DailyPnlMap> {
  const res = await apiFetch<{ success: boolean; days: DailyPnlMap }>(
    `/dashboard/daily-pnl${exchangeQuery(exchange)}`,
    { auth: true },
  )
  // PHP serializes an empty map as [] — normalize to an object
  return Array.isArray(res.days) ? {} : res.days
}

export async function getAssetPerformance(
  exchange: ExchangeFilter = 'all',
): Promise<AssetPerformanceData> {
  const res = await apiFetch<
    { success: boolean } & AssetPerformanceData
  >(`/dashboard/asset-performance${exchangeQuery(exchange)}`, { auth: true })
  return { balance: res.balance, assets: res.assets }
}

/** Open positions across every connected exchange (each row says which). */
export async function getOpenPositions(
  exchange: ExchangeFilter = 'all',
): Promise<OpenPosition[]> {
  const res = await apiFetch<{ success: boolean; positions: OpenPosition[] }>(
    `/binance/positions${exchangeQuery(exchange)}`,
    { auth: true },
  )
  return res.positions
}

/** Closed trades across every connected exchange, newest first. */
export async function getPastPositions(
  exchange: ExchangeFilter = 'all',
): Promise<PastPosition[]> {
  const res = await apiFetch<{ success: boolean; positions: PastPosition[] }>(
    `/binance/past-positions${exchangeQuery(exchange)}`,
    { auth: true },
  )
  return res.positions
}
