import type { AuthUser } from './auth'

/** GET /auth/discord/config */
export interface DiscordConfig {
  /** Client id + secret are set: the flow works (reachable at /auth/discord/start). */
  configured: boolean
  /** `configured` AND the rollout switch: the button is shown on /auth. */
  enabled: boolean
  /** Discord's authorize URL minus `state` and `redirect_uri`; null until configured. */
  authorize_url: string | null
}

/** What the API lets the SPA show while the user finishes — never a token. */
export interface DiscordProfile {
  name: string
  username: string
  email: string
  avatar_url: string
}

/** POST /auth/discord/callback — one of three outcomes. */
export type DiscordCallbackResult =
  | { status: 'logged_in'; token: string; user: AuthUser; message: string }
  | { status: 'password_required'; link_token: string; profile: DiscordProfile }
  | { status: 'terms_required'; signup_token: string; profile: DiscordProfile }

export interface DiscordLoggedIn {
  status: 'logged_in'
  token: string
  user: AuthUser
  message: string
}

/** What the SPA remembers between sending the user to Discord and their return. */
export interface DiscordPendingFlow {
  nonce: string
  intent: 'login' | 'link'
  /** Where to land after a successful link (login always goes to the dashboard). */
  returnTo: string
  /** Epoch ms when the flow was started; stale records are discarded. */
  at: number
}
