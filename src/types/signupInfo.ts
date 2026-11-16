import type { SignupSource } from '../lib/signupSources'

/** How the team reaches the user (Settings ↔ `GET|PUT /user/contacts`). Typed, never verified. */
export interface ContactHandles {
  telegram: string | null
  discord: string | null
  /** E.164, e.g. `+66812345678`. */
  whatsapp: string | null
}

/** `GET|PUT /user/contacts` — the values plus what the API decided about them. */
export interface ContactStatus {
  contacts: ContactHandles
  /** The required ones not given yet (`telegram`, `whatsapp`), in that order. */
  missing: Array<'telegram' | 'whatsapp'>
  /** A customer missing either may not connect an exchange (staff never are). */
  connect_locked: boolean
}

export type AccessEventKind = 'register' | 'login'
export type AccessMethod = 'password' | 'discord'
export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown'

/**
 * One sign-up or sign-in, as the API recorded it. `ip`, `country` and the
 * browser/OS come from the request itself; `timezone` / `language` /
 * `screen` only when that device chose "Accept all" (`consent`).
 */
export interface AccessEvent {
  id: number
  event: AccessEventKind
  method: AccessMethod
  ip: string | null
  /** ISO 3166 alpha-2 from Cloudflare; null locally or when unknown. */
  country: string | null
  device_type: DeviceType
  browser: string | null
  os: string | null
  user_agent: string | null
  timezone: string | null
  language: string | null
  screen: string | null
  consent: 'all' | 'essential' | null
  created_at: string
}

/** `GET /admin/users/{uniId}/signup-info` — every staff role, collaborators included. */
export interface AdminSignupInfo {
  signup: {
    registered_at: string | null
    /** How the account was created; null for accounts older than this record. */
    method: AccessMethod | null
    sources: { source: SignupSource; detail: string | null }[]
    contacts: ContactHandles & {
      /** The username Discord itself confirmed (Sign in with Discord), when linked. */
      discord_linked: string | null
    }
    /** The sign-up's own fingerprint. */
    first: AccessEvent | null
  }
  /** Newest first, at most 25 — the sign-up and every sign-in after it. */
  events: AccessEvent[]
}
