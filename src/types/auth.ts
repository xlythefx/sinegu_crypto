export type UserStatus = 'pending' | 'active' | 'suspended'

/**
 * `user_credentials.type`. `developer` is staff too, plus the Database console
 * and test-mode payments — see `lib/roles.ts`.
 */
export type UserRole = 'user' | 'admin' | 'master' | 'developer'

export interface AuthUser {
  uni_id: string
  name: string
  email: string
  status: UserStatus
  /** Account role — 'user' by default on register. */
  type?: UserRole
  /** ISO date the account was created (returned by /auth/me). */
  created_at?: string
  /** Profile image (data URL or path) — local-only until upload is wired. */
  user_profile?: string | null
  /** Banner image (data URL or path) — local-only until upload is wired. */
  user_banner?: string | null
  /**
   * True when a non-deleted exchange account is connected. Returned by
   * /auth/me; absent in sessions stored before this field existed — treat
   * undefined as "unknown", never as "not connected".
   */
  has_exchange_account?: boolean
  /**
   * False for an account created through Discord that has not set a password
   * yet: Settings offers "Set a password" instead of "Change password", and
   * Discord cannot be disconnected. Undefined (older session) = assume true.
   */
  has_password?: boolean
  /** The linked Discord account, or null. `id` is a snowflake — keep it a string. */
  discord?: DiscordLink | null
}

export interface DiscordLink {
  id: string
  username: string
  linked_at: string | null
}

export interface AuthResponse {
  success: boolean
  message: string
  token: string
  user: AuthUser
}
