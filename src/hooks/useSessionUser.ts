import { useEffect, useState } from 'react'
import { getUser, SESSION_EVENT } from '../lib/session'
import type { AuthUser } from '../types/auth'

/**
 * The current session user, kept in sync across the app. Re-reads whenever the
 * session changes (login, logout, profile-image edit) — in this tab via the
 * SESSION_EVENT, and across tabs via the storage event.
 */
export function useSessionUser(): AuthUser | null {
  const [user, setUser] = useState<AuthUser | null>(() => getUser())

  useEffect(() => {
    const sync = () => setUser(getUser())
    window.addEventListener(SESSION_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(SESSION_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return user
}
