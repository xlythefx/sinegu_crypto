/**
 * High-risk alerts (API `RiskAlerts`): things that can lose real money if
 * nobody acts — every one was emailed to the high-risk list when raised, and
 * stays on Admin → Overview until a full admin marks it resolved.
 */
export type RiskAlertKind =
  | 'feed_breach'
  | 'exit_stuck'
  | 'kill_switch'
  | 'key_refused'
  | 'engine_down'
  | 'assets_unavailable'

export interface RiskAlert {
  id: number
  /** A kind this build does not know still renders (as plain text, no fix link). */
  kind: RiskAlertKind | (string & {})
  /** The plain-English name of the kind ("Wrong accounts traded"). */
  label: string
  title: string
  /** Plain sentences — rendered as text, never as markup. */
  lines: string[]
  exchange: string | null
  /** The Signal Log row it came from, when it came from one. */
  trade_log_id: number | null
  /** How many times it was raised while open. */
  occurrences: number
  first_seen_at: string | null
  last_seen_at: string | null
  emailed: boolean
}

/** A row of `GET /admin/risk-alerts?status=all` — resolved ones included. */
export interface RiskAlertHistoryRow extends RiskAlert {
  resolved_at: string | null
  resolved_by: string | null
  resolve_note: string | null
}

export type RiskAlertStatus = 'open' | 'all'
