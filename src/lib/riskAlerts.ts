/**
 * Pure helpers for the high-risk alerts on Admin → Overview: where each kind
 * is fixed, and the "seen N times" line.
 */

import type { RiskAlertKind } from '../types/riskAlerts'

/** The page that fixes each kind of alert. */
export const RISK_ALERT_FIX: Record<RiskAlertKind, { to: string; label: string }> = {
  feed_breach: { to: '/admin/trade-logs', label: 'Open the Signal Log' },
  assets_unavailable: { to: '/admin/trade-logs', label: 'Open the Signal Log' },
  exit_stuck: { to: '/admin?tab=positions', label: 'Open positions' },
  kill_switch: { to: '/admin/assets', label: 'Trading Assets' },
  key_refused: { to: '/admin/api-keys', label: 'API Keys' },
  engine_down: { to: '/admin/engine', label: 'Bot Engine' },
}

/** The fix link for a kind, or null for a kind this build does not know. */
export function riskAlertFix(kind: string): { to: string; label: string } | null {
  return Object.prototype.hasOwnProperty.call(RISK_ALERT_FIX, kind)
    ? RISK_ALERT_FIX[kind as RiskAlertKind]
    : null
}

/** "1 high-risk alert" / "3 high-risk alerts". */
export function riskAlertCount(n: number): string {
  return `${n} high-risk alert${n === 1 ? '' : 's'}`
}
