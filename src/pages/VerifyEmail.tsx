import { useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import AuthFrame, { AuthBrand } from '../components/auth/AuthFrame'
import VerifyEmailForm from '../components/auth/VerifyEmailForm'
import { useMe } from '../hooks/useMe'
import { useSessionUser } from '../hooks/useSessionUser'
import { logout } from '../services/auth'
import { isLoggedIn } from '../lib/session'

/**
 * `/auth/verify` — the signed-in, not-yet-verified user types the six-digit
 * code mailed at sign-up. No session → sign in; already verified → dashboard.
 */
export default function VerifyEmail() {
  if (!isLoggedIn()) return <Navigate to="/auth" replace />
  return <VerifyEmailScreen />
}

function VerifyEmailScreen() {
  const navigate = useNavigate()
  // Refresh from /auth/me (a 401 clears the session and goes to /auth); the
  // session user is the render source so the refreshed verdict lands here.
  useMe()
  const user = useSessionUser()

  useEffect(() => {
    document.title = 'Verify your email — Pixel Alpha'
  }, [])

  // Only an explicit `true` leaves: a legacy session (field absent) reaches
  // this page only through the API's EMAIL_UNVERIFIED redirect, so waiting
  // for /auth/me is the right call — bouncing it would loop.
  if (!user) return <Navigate to="/auth" replace />
  if (user.email_verified === true) return <Navigate to="/dashboard" replace />

  return (
    <AuthFrame back={{ to: '/', label: '← Home' }}>
      <AuthBrand />
      <VerifyEmailForm
        email={user.email}
        onVerified={() => navigate('/dashboard', { replace: true })}
        onSignOut={async () => {
          try {
            await logout()
          } catch {
            // Cleared locally either way.
          } finally {
            navigate('/auth?mode=register', { replace: true })
          }
        }}
      />
    </AuthFrame>
  )
}
