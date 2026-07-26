import type { AuthUser } from '../types/auth'

const TOKEN_KEY = 'sinegu-token'
const USER_KEY = 'sinegu-user'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

/** Fired whenever the stored session user changes (login, logout, profile edit). */
export const SESSION_EVENT = 'sinegu:session'

function emitSessionChange(): void {
  window.dispatchEvent(new Event(SESSION_EVENT))
}

export function saveSession(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  emitSessionChange()
}

/** Update the stored user without touching the token (e.g. after a profile edit). */
export function saveUser(user: AuthUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  emitSessionChange()
}

/** Merge a partial patch into the stored user (e.g. a new profile image). */
export function updateStoredUser(patch: Partial<AuthUser>): void {
  const current = getUser()
  if (!current) return
  saveUser({ ...current, ...patch })
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  emitSessionChange()
}

export function isLoggedIn(): boolean {
  return getToken() !== null
}
