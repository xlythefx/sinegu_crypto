/**
 * The `?ref=CODE` from an invite link, kept across the sign-up flow.
 *
 * Password registration submits it from the same page it arrived on, but a
 * Discord sign-up leaves the site and comes back — possibly in a different
 * tab, possibly after a restart of the flow — so the code is parked in
 * localStorage for a week and read back by whichever form finishes. Invalid
 * codes are ignored server-side, so nothing here validates.
 */

const KEY = 'pa:ref'
const TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Normalise a raw query value; null when empty. */
export function normaliseReferralCode(raw: string | null | undefined): string | null {
  const code = raw?.trim().toUpperCase() ?? ''
  return code === '' ? null : code
}

export function rememberReferralCode(code: string | null): void {
  if (!code) return
  try {
    localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() }))
  } catch {
    // Private mode / blocked storage: the code still rides the current page.
  }
}

export function recallReferralCode(): string | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { code?: unknown; at?: unknown }
    if (typeof parsed.code !== 'string' || typeof parsed.at !== 'number') return null
    if (Date.now() - parsed.at > TTL_MS) {
      localStorage.removeItem(KEY)
      return null
    }
    return normaliseReferralCode(parsed.code)
  } catch {
    return null
  }
}

export function forgetReferralCode(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nothing to forget
  }
}
