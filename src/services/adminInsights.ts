import { apiFetch } from './api'
import type { AdminExchangeScope, DailyPnlMap } from '../types/admin'
import type {
  CustomerInsights,
  MoneyInsights,
  OverviewInsights,
  PlatformInsights,
  PlatformScope,
  StrategyInsights,
  SystemInsights,
} from '../types/adminInsights'

/** The admin dashboard's tabs — read-only, cached a minute server-side. */
async function getInsight<T>(path: string): Promise<T> {
  const { success: _ok, ...rest } = await apiFetch<{ success: boolean } & T>(
    `/admin/insights/${path}`,
    { auth: true },
  )
  return rest as T
}

export const getOverviewInsights = () => getInsight<OverviewInsights>('overview')
export const getCustomerInsights = () => getInsight<CustomerInsights>('customers')
export const getMoneyInsights = () => getInsight<MoneyInsights>('money')
export const getSystemInsights = () => getInsight<SystemInsights>('system')

export const getPlatformInsights = (scope: PlatformScope) =>
  getInsight<PlatformInsights>(`platform?scope=${scope}`)

/** The pooled P&L calendar — same days map as /admin/daily-pnl, trades named. */
export async function getPlatformDailyPnl(scope: PlatformScope): Promise<DailyPnlMap> {
  const { days } = await getInsight<{ days: DailyPnlMap }>(`platform/daily-pnl?scope=${scope}`)
  // PHP serializes an empty map as [] — normalize to an object
  return Array.isArray(days) ? {} : days
}

export function getStrategyInsights(
  exchange: AdminExchangeScope = 'all',
  from?: string,
  to?: string,
): Promise<StrategyInsights> {
  const params = new URLSearchParams()
  if (exchange !== 'all') params.set('exchange', exchange)
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const qs = params.toString()
  return getInsight<StrategyInsights>(qs ? `strategies?${qs}` : 'strategies')
}
