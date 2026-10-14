/**
 * The cookie-style consent banner's choice, and the device details it gates.
 *
 * Two levels, and what each one actually changes:
 * - `essential` — the site keeps only what it cannot work without (session
 *   token, theme, this choice). At sign-up and sign-in the API still records
 *   the IP address, country and browser/OS it reads from the request itself:
 *   that is security logging (every server sees those headers anyway) and
 *   the Privacy Policy says so.
 * - `all` — additionally, sign-up and sign-in send this device's time zone,
 *   language and screen size, for statistics. The API drops them unless the
 *   request also says `consent: 'all'`, so this file is not the only gate.
 *
 * Stored per browser in localStorage (there is no account yet when the banner
 * first shows). Wrapped in try/catch everywhere: a private window or blocked
 * storage simply reads as "not chosen yet".
 */

export type ConsentChoice = 'all' | 'essential'

const STORAGE_KEY = 'pixel-alpha-consent'
/** Bump when the banner's wording changes materially, so everyone is asked again. */
const CONSENT_VERSION = 1

/** Fired on `window` when the choice changes or the banner should reopen. */
export const CONSENT_CHANGED_EVENT = 'pixel-alpha-consent-changed'
export const CONSENT_OPEN_EVENT = 'pixel-alpha-consent-open'

interface StoredConsent {
  v: number
  choice: ConsentChoice
  at: string
}

export function readConsent(): ConsentChoice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredConsent>
    if (parsed.v !== CONSENT_VERSION) return null
    return parsed.choice === 'all' || parsed.choice === 'essential' ? parsed.choice : null
  } catch {
    return null
  }
}

export function saveConsent(choice: ConsentChoice): void {
  try {
    const value: StoredConsent = { v: CONSENT_VERSION, choice, at: new Date().toISOString() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Storage blocked: the choice holds for this page view only.
  }
  window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT))
}

/** Reopen the banner (footer "Privacy choices" link, Privacy Policy page). */
export function openConsentBanner(): void {
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))
}

export interface ClientInfo {
  timezone?: string
  language?: string
  screen?: string
}

function clientInfo(): ClientInfo {
  const info: ClientInfo = {}
  try {
    info.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
  } catch {
    // no Intl time zone — leave it out
  }
  if (navigator.language) info.language = navigator.language
  if (window.screen?.width && window.screen?.height) {
    info.screen = `${window.screen.width}x${window.screen.height}`
  }
  return info
}

/**
 * The body fragment every sign-up / sign-in call carries: the consent level
 * always, the device details only with `all`.
 */
export function deviceContext(): { consent: ConsentChoice | null; client?: ClientInfo } {
  const consent = readConsent()
  return consent === 'all' ? { consent, client: clientInfo() } : { consent }
}
