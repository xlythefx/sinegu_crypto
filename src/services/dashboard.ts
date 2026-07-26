import { apiFetch } from './api'
import type {
  AssetPerformanceData,
  DailyPnlMap,
  DashboardSummary,
  OpenPosition,
  PastPosition,
} from '../types/dashboard'

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const res = await apiFetch<{ success: boolean; summary: DashboardSummary }>(
    '/dashboard/summary',
    { auth: true },
  )
  // PHP serializes an empty keyed collection as [] — normalize to an object
  if (Array.isArray(res.summary.daily_pnl)) res.summary.daily_pnl = {}
  return res.summary
}

export async function getDashboardDailyPnl(): Promise<DailyPnlMap> {
  const res = await apiFetch<{ success: boolean; days: DailyPnlMap }>(
    '/dashboard/daily-pnl',
    { auth: true },
  )
  // PHP serializes an empty map as [] — normalize to an object
  return Array.isArray(res.days) ? {} : res.days
}

export async function getAssetPerformance(): Promise<AssetPerformanceData> {
  const res = await apiFetch<
    { success: boolean } & AssetPerformanceData
  >('/dashboard/asset-performance', { auth: true })
  return { balance: res.balance, assets: res.assets }
}

export async function getOpenPositions(): Promise<OpenPosition[]> {
  const res = await apiFetch<{ success: boolean; positions: OpenPosition[] }>(
    '/binance/positions',
    { auth: true },
  )
  return res.positions
}

export async function getPastPositions(): Promise<PastPosition[]> {
  const res = await apiFetch<{ success: boolean; positions: PastPosition[] }>(
    '/binance/past-positions',
    { auth: true },
  )
  return res.positions
}
