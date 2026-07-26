export type UserStatus = 'pending' | 'active' | 'suspended'
export type UserRole = 'user' | 'admin' | 'master'

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
}

export interface AuthResponse {
  success: boolean
  message: string
  token: string
  user: AuthUser
}
