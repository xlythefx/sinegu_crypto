import type { UserRole } from './admin'

/** Who did it: the user themselves, a sign-in / sign-up, or an admin. */
export type ActivitySource = 'customer' | 'signin' | 'admin'

/** What it is about — the row's colour. */
export type ActivityArea = 'account' | 'exchange' | 'billing' | 'signin'

/** One row of GET /admin/activity (Admin → Activity, 2026-11-23). */
export interface ActivityItem {
  /** `${source}:${id}` — unique across the three sources. */
  key: string
  source: ActivitySource
  at: string
  action: string
  area: ActivityArea
  title: string
  /** Sign-ins: "Chrome 141 · Windows · desktop". */
  detail: string | null
  ip: string | null
  country: string | null
  /** The user it is about; null for a team setting (e.g. a notification change). */
  subject: { uni_id: string; name: string | null; type: UserRole | null } | null
  /** Admin rows only: who did it ("System" when nobody). */
  actor: { uni_id: string | null; name: string } | null
}

export interface ActivityPage {
  items: ActivityItem[]
  total: number
  page: number
  per_page: number
}

/** One team email on Admin → Notifications (GET /admin/notifications). */
export interface TeamNotice {
  slug: string
  group: 'Customers' | 'Billing' | 'Trading'
  title: string
  when: string
  /** Cannot be switched off or left without an address. */
  critical: boolean
  enabled: boolean
  /** true = the server's default list (nothing saved for this notice yet). */
  uses_default: boolean
  recipients: string[]
  default_recipients: string[]
  default_source: 'MAIL_ADMIN_ADDRESS' | 'TRADE_ALERT_EMAILS'
  updated_at: string | null
  updated_by: string | null
}
