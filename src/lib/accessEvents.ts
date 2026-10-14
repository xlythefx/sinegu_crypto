import type { AccessEvent, AccessMethod, DeviceType } from '../types/signupInfo'

/** The day sign-up details started being recorded — older accounts have none. */
export const SIGNUP_INFO_SINCE = '2026-10-14'

let regionNames: Intl.DisplayNames | null | undefined

/** "TH" → "Thailand"; the bare code when the browser cannot name it. */
export function countryName(code: string | null): string | null {
  if (!code) return null
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
    } catch {
      regionNames = null
    }
  }
  try {
    return regionNames?.of(code) ?? code
  } catch {
    return code
  }
}

const DEVICE_LABELS: Record<DeviceType, string> = {
  desktop: 'Computer',
  mobile: 'Phone',
  tablet: 'Tablet',
  bot: 'Script / bot',
  unknown: 'Unknown device',
}

export function deviceTypeLabel(type: DeviceType): string {
  return DEVICE_LABELS[type] ?? DEVICE_LABELS.unknown
}

/** "Chrome 141 · Windows" — whatever parts were recognised, or null. */
export function browserOs(e: Pick<AccessEvent, 'browser' | 'os'>): string | null {
  const parts = [e.browser, e.os].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

export function methodLabel(method: AccessMethod | null): string {
  if (method === 'discord') return 'Discord'
  if (method === 'password') return 'Email & password'
  return 'Not recorded'
}

export function consentLabel(consent: AccessEvent['consent']): string {
  if (consent === 'all') return 'Accepted all'
  if (consent === 'essential') return 'Essentials only'
  return 'No choice made'
}
