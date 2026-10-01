import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import AOS from 'aos'
import 'aos/dist/aos.css'
import DashboardShell from './DashboardShell'
import TraderSidebar from './TraderSidebar'
import TopBar from './TopBar'
import OnboardingGate from './OnboardingGate'
import ConfirmModal from '../ui/ConfirmModal'
import { ExchangeFilterProvider } from '../../context/ExchangeFilterContext'
import { logout } from '../../services/auth'
import { useSessionUser } from '../../hooks/useSessionUser'
import { needsEmailVerification, VERIFY_EMAIL_PATH } from '../../lib/emailVerification'

interface DashboardLayoutProps {
  title: string
  children: ReactNode
}

/**
 * Shared chrome for every dashboard page: shell + sidebar + top bar, AOS init,
 * and the standard yes/no logout confirmation. Also owns the top bar's
 * exchange filter, so the page content below can read the same value the
 * pills write (it survives navigation via localStorage — each page mounts
 * its own layout).
 */
export default function DashboardLayout({
  title,
  children,
}: DashboardLayoutProps) {
  const navigate = useNavigate()
  const [confirmLogout, setConfirmLogout] = useState(false)

  useEffect(() => {
    AOS.init({ duration: 700, once: true, offset: 80, easing: 'ease-out-cubic' })
  }, [])

  // Title now only names the browser tab — the top bar no longer displays it
  useEffect(() => {
    document.title = `${title} — Pixel Alpha`
  }, [title])

  // Unverified sign-ups belong on the code screen. OnboardingGate's useMe()
  // refreshes /auth/me into the session, so a verdict changed server-side
  // lands here too. Cosmetic — the API's EMAIL_UNVERIFIED 403 is the gate.
  const user = useSessionUser()
  if (needsEmailVerification(user)) return <Navigate to={VERIFY_EMAIL_PATH} replace />

  return (
    <ExchangeFilterProvider>
      <DashboardShell
        sidebar={<TraderSidebar onLogout={() => setConfirmLogout(true)} />}
      >
        <TopBar />
        <OnboardingGate />
        {children}
        <ConfirmModal
          open={confirmLogout}
          title="Log out?"
          message="You will be signed out of your trader portal."
          confirmLabel="Yes, log out"
          cancelLabel="No"
          danger
          onConfirm={async () => {
            setConfirmLogout(false)
            try {
              await logout()
            } catch {
              // An expired token answers 401 — which is exactly when someone
              // reaches for Log out. The session is cleared locally either way.
            } finally {
              navigate('/auth')
            }
          }}
          onCancel={() => setConfirmLogout(false)}
        />
      </DashboardShell>
    </ExchangeFilterProvider>
  )
}
