import type { SignupSource } from '../lib/signupSources'

/** Admin → Visitors. Shapes of `GET /admin/visitors/{summary,log}` (VisitorStats). */

export type VisitorDevice = 'desktop' | 'mobile' | 'tablet'

/** Why a ping was not counted (VisitRecorder::FILTERS), plus the suspicious rows kept. */
export type VisitFilterReason = 'bot' | 'foreign' | 'unknown_page' | 'team' | 'flood' | 'repeat'

export type VisitFunnelKey = 'visited' | 'opened_signup' | 'signed_up' | 'verified' | 'approved' | 'connected'

export interface VisitorRange {
  from: string
  to: string
}

/** One value of a breakdown (country code, device, browser family…); null = not known. */
export interface VisitorCount<V = string> {
  value: V | null
  visitors: number
}

export interface VisitorSummary {
  success: boolean
  range: VisitorRange
  /** The first day anything was counted, or null when nothing has been yet. */
  since: string | null
  ip_days: number
  totals: {
    visitors: number
    views: number
    signups: number
    /** Sign-ups per 100 visitors; null with no visitors. */
    signup_rate: number | null
    live_now: number
  }
  bucket: 'day' | 'week'
  series: { start: string; visitors: number; views: number; signups: number }[]
  funnel: { key: VisitFunnelKey; count: number }[]
  pages: { path: string; views: number; visitors: number }[]
  sources: { label: string; direct: boolean; hosts: string[]; visitors: number }[]
  referral_codes: { code: string; owner: { uni_id: string; name: string | null } | null; visitors: number }[]
  campaigns: { source: string | null; campaign: string | null; visitors: number }[]
  heard_about: { slug: SignupSource; count: number }[]
  countries: VisitorCount[]
  devices: VisitorCount<VisitorDevice>[]
  browsers: VisitorCount[]
  systems: VisitorCount[]
  filtered: Record<VisitFilterReason | 'suspicious', number>
}

export type VisitorLogView = 'clean' | 'suspicious' | 'all'

export interface VisitorAccount {
  uni_id: string
  name: string | null
}

export interface VisitorLogRow {
  id: number
  at: string
  path: string
  /** Null once it is older than `ip_days`. */
  ip: string | null
  country: string | null
  device_type: VisitorDevice
  browser: string | null
  os: string | null
  /** "Google", "Direct"… — only on the first page of a visit. */
  source: string | null
  referrer_host: string | null
  ref_code: string | null
  utm_source: string | null
  utm_campaign: string | null
  entry: boolean
  signed_in: boolean
  suspicious: boolean
  suspicious_reason: 'flood' | 'burst' | null
  /** Accounts that signed up or signed in from this IP. */
  accounts: VisitorAccount[]
}

export interface VisitorIpDetail {
  ip: string
  views: number
  suspicious_views: number
  first_seen: string | null
  last_seen: string | null
  countries: string[]
  accounts: VisitorAccount[]
}

export interface VisitorLog {
  success: boolean
  range: VisitorRange
  rows: VisitorLogRow[]
  pagination: { total: number; limit: number; offset: number }
  options: { pages: string[]; countries: string[] }
  ip_detail: VisitorIpDetail | null
}

export interface VisitorLogFilters {
  from: string
  to: string
  view: VisitorLogView
  page: string
  country: string
  device: string
  ip: string
  q: string
}
