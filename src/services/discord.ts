import { apiFetch } from './api'
import { saveSession } from '../lib/session'
import { TERMS } from '../lib/terms'
import type { AuthUser } from '../types/auth'
import type {
  DiscordCallbackResult,
  DiscordConfig,
  DiscordLoggedIn,
} from '../types/discord'

/**
 * "Sign in with Discord". The OAuth exchange happens on the API (the client
 * secret never reaches the browser); this file is the four calls the SPA
 * makes around it. Every "logged in" answer is saved to the session here,
 * exactly like `services/auth.ts` does for password login.
 */

/** Whether the button is shown / the flow works. Any failure reads as "off". */
export async function getDiscordConfig(): Promise<DiscordConfig> {
  try {
    const res = await apiFetch<{ success: boolean } & DiscordConfig>('/auth/discord/config')
    return { configured: res.configured, enabled: res.enabled, authorize_url: res.authorize_url }
  } catch {
    return { configured: false, enabled: false, authorize_url: null }
  }
}

/** The redirect URI for THIS origin — must be on the API's allow-list. */
export function discordRedirectUri(): string {
  return `${window.location.origin}/auth/discord/callback`
}

/**
 * Hand the authorization code to the API. Three outcomes: logged in (session
 * saved), the account's password is needed, or the Terms step for a new user.
 */
export async function exchangeDiscordCode(code: string): Promise<DiscordCallbackResult> {
  const res = await apiFetch<DiscordCallbackResult>('/auth/discord/callback', {
    method: 'POST',
    body: { code, redirect_uri: discordRedirectUri() },
  })
  if (res.status === 'logged_in') saveSession(res.token, res.user)
  return res
}

/** The existing-email path: prove the account is theirs with its password. */
export async function linkDiscordWithPassword(
  linkToken: string,
  password: string,
): Promise<DiscordLoggedIn> {
  const res = await apiFetch<DiscordLoggedIn>('/auth/discord/link-with-password', {
    method: 'POST',
    body: { link_token: linkToken, password },
  })
  saveSession(res.token, res.user)
  return res
}

/** The Terms step: create the account. Mirrors `register()`'s terms fields. */
export async function completeDiscordSignup(
  signupToken: string,
  name: string | null,
  referralCode?: string | null,
): Promise<DiscordLoggedIn> {
  const res = await apiFetch<DiscordLoggedIn>('/auth/discord/complete', {
    method: 'POST',
    body: {
      signup_token: signupToken,
      terms: true,
      terms_version: TERMS.updatedAt,
      ...(name ? { name } : {}),
      ...(referralCode ? { referral_code: referralCode } : {}),
    },
  })
  saveSession(res.token, res.user)
  return res
}

/** Settings → Connect Discord for a signed-in user. */
export function linkDiscord(code: string): Promise<{ success: boolean; user: AuthUser }> {
  return apiFetch('/user/discord/link', {
    method: 'POST',
    auth: true,
    body: { code, redirect_uri: discordRedirectUri() },
  })
}

/** Settings → Disconnect Discord. Refused (NO_PASSWORD) while the account has no password. */
export function unlinkDiscord(): Promise<{ success: boolean; user: AuthUser }> {
  return apiFetch('/user/discord', { method: 'DELETE', auth: true })
}
