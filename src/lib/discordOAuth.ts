import type { DiscordPendingFlow } from '../types/discord'

/**
 * The browser's half of the Discord OAuth handshake.
 *
 * The API has no session, so the CSRF defence lives HERE: before leaving for
 * Discord the SPA mints a random nonce, keeps it, and sends it as `state`;
 * on return the callback page accepts the code only if the `state` Discord
 * echoes back matches what this browser stored. A code delivered to a
 * browser that never started the flow (a login-CSRF link) fails that check.
 *
 * localStorage rather than sessionStorage: a phone browser can open the
 * Discord redirect in a new tab, and sessionStorage does not follow. Nothing
 * client-side survives a switch to an in-app browser, though — that case is
 * reported as "we couldn't confirm this sign-in started here" with a button
 * to start again, not as a dead end.
 */

const KEY = 'pa:discord-oauth'
const TTL_MS = 10 * 60 * 1000

function randomNonce(): string {
  // randomUUID needs a secure context; getRandomValues works on plain http too.
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Only same-origin paths may be a return target — never a full URL. */
export function safeReturnTo(raw: string | null | undefined, fallback = '/dashboard'): string {
  if (!raw) return fallback
  return /^\/(?!\/)/.test(raw) ? raw : fallback
}

/**
 * Start a flow: remember it, then hand back the URL to send the browser to.
 * `authorizeUrl` is the API's (client id, scopes); `state` and `redirect_uri`
 * are added here because both belong to THIS browser and origin.
 */
export function beginDiscordFlow(
  authorizeUrl: string,
  intent: DiscordPendingFlow['intent'],
  returnTo: string,
  redirectUri: string,
): string {
  const record: DiscordPendingFlow = {
    nonce: randomNonce(),
    intent,
    returnTo: safeReturnTo(returnTo),
    at: Date.now(),
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(record))
  } catch {
    // Storage blocked: the callback will report the mismatch and offer a restart.
  }

  const url = new URL(authorizeUrl)
  url.searchParams.set('state', record.nonce)
  url.searchParams.set('redirect_uri', redirectUri)
  return url.toString()
}

/**
 * Take the pending record out of storage (it is single-use either way) and
 * return it only if `state` is the nonce this browser minted and it is fresh.
 */
export function consumeDiscordFlow(state: string | null): DiscordPendingFlow | null {
  let record: DiscordPendingFlow | null = null
  try {
    const raw = localStorage.getItem(KEY)
    localStorage.removeItem(KEY)
    if (raw) record = JSON.parse(raw) as DiscordPendingFlow
  } catch {
    record = null
  }

  if (!record || !state || record.nonce !== state) return null
  if (typeof record.at !== 'number' || Date.now() - record.at > TTL_MS) return null
  if (record.intent !== 'login' && record.intent !== 'link') return null

  return { ...record, returnTo: safeReturnTo(record.returnTo) }
}
