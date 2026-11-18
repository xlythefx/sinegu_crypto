import { apiFetch } from './api'
import type { RiskAlertHistoryRow, RiskAlertStatus } from '../types/riskAlerts'

/** GET /admin/risk-alerts — newest first, at most 100. Full admins only. */
export async function getRiskAlerts(status: RiskAlertStatus = 'open'): Promise<RiskAlertHistoryRow[]> {
  const res = await apiFetch<{ success: boolean; alerts: RiskAlertHistoryRow[] }>(
    `/admin/risk-alerts?status=${status}`,
    { auth: true },
  )
  return res.alerts
}

/** Someone resolved it first (409) — the caller just refreshes. */
export const RISK_ALERT_ALREADY_RESOLVED = 'ALREADY_RESOLVED'

/**
 * POST /admin/risk-alerts/{id}/resolve — "I have dealt with it". The API
 * forgets the cached overview, so a refetch right after no longer lists it.
 */
export async function resolveRiskAlert(id: number, note?: string): Promise<void> {
  const trimmed = note?.trim()
  await apiFetch<{ success: boolean }>(`/admin/risk-alerts/${id}/resolve`, {
    method: 'POST',
    body: trimmed ? { note: trimmed } : {},
    auth: true,
  })
}
