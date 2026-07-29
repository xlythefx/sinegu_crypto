import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import AOS from 'aos'
import 'aos/dist/aos.css'
import DashboardShell from './DashboardShell'
import TraderSidebar from './TraderSidebar'
import TopBar from './TopBar'
import ConfirmModal from '../ui/ConfirmModal'
import { logout } from '../../services/auth'

interface DashboardLayoutProps {
  title: string
  children: ReactNode
}

/**
 * Shared chrome for every dashboard page: shell + sidebar + top bar, AOS init,
 * and the standard yes/no logout confirmation.
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
    document.title = `${title} — SineguAlerts`
  }, [title])

  return (
    <DashboardShell
      sidebar={<TraderSidebar onLogout={() => setConfirmLogout(true)} />}
    >
      <TopBar />
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
          } finally {
            navigate('/auth')
          }
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </DashboardShell>
  )
}
