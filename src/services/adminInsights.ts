import { apiFetch } from './api'
import type { AdminExchangeScope } from '../types/admin'
import type {
  CustomerInsights,
  MoneyInsights,
  OverviewInsights,
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
