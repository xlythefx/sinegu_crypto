import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../services/api'
import { getMe } from '../services/user'
import { clearSession, getUser, saveUser } from '../lib/session'
import type { AuthUser } from '../types/auth'

/**
 * Loads the authenticated user from GET /auth/me, falling back to the
 * session-stored user while the request is in flight. A 401 clears the
 * session and redirects to /auth.
 */
export function useMe() {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(() => getUser())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    getMe()
      .then((res) => {
        if (cancelled) return
        setUser(res.user)
        // Keep the session in sync (image URLs, name, role) so the nav and
        // top-bar avatars reflect the backend on every load.
        saveUser(res.user)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          clearSession()
          navigate('/auth')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [navigate])

  return { user, setUser, loading }
}
