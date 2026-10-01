import { useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Menu } from 'lucide-react'
import AOS from 'aos'
import 'aos/dist/aos.css'
import DashboardShell, { ShellContext } from '../dashboard/DashboardShell'
import AdminSidebar from './AdminSidebar'
import ConfirmModal from '../ui/ConfirmModal'
import UserAvatar from '../ui/UserAvatar'
import { useTheme } from '../../theme'
import { useSessionUser } from '../../hooks/useSessionUser'
import { useMe } from '../../hooks/useMe'
import { needsEmailVerification, VERIFY_EMAIL_PATH } from '../../lib/emailVerification'
import {
  canSeeAdminPortal,
  collaboratorMayOpen,
  isCollaborator,
} from '../../lib/roles'
import { logout } from '../../services/auth'
import {
  TOPBAR,
  BURGER,
  TOPBAR_RIGHT,
  THEME_TOGGLE,
  THEME_TOGGLE_ICON,
} from '../dashboard/shellClasses'

interface AdminLayoutProps {
  title: string
  subtitle?: string
  children: ReactNode
}

/** Admin top bar: burger + title/subtitle left; theme toggle + avatar right. */
function AdminTopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { theme, toggleTheme } = useTheme()
  const { openDrawer } = useContext(ShellContext)
  const user = useSessionUser()

  return (
    <div className={TOPBAR}>
      <button
        type="button"
        className={BURGER}
        onClick={openDrawer}
        aria-label="Open menu"
      >
        <Menu size={20} strokeWidth={2.2} />
      </button>
      <div>
        <div className="font-display text-[18px] font-bold">{title}</div>
        {subtitle && (
          <div className="text-[12px] text-muted mt-px">{subtitle}</div>
        )}
      </div>
      <div className={TOPBAR_RIGHT}>
        <button
          className={THEME_TOGGLE}
          title="Toggle theme"
          onClick={toggleTheme}
        >
          <span className={THEME_TOGGLE_ICON}>
            {theme === 'dark' ? '☀' : '☾'}
          </span>
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        <UserAvatar user={user} size={34} />
      </div>
    </div>
  )
}

/**
 * Chrome + client-side guard for admin pages. Only staff rows
 * (master/admin/developer, plus the read-only collaborator) may enter; plain
 * users bounce to their dashboard. A collaborator on a path outside
 * `collaboratorMayOpen` lands on /admin instead.
 * (Cosmetic gate only — real enforcement lives in the API's admin middleware.)
 */
export default function AdminLayout({
  title,
  subtitle,
  children,
}: AdminLayoutProps) {
  const navigate = useNavigate()
  const [confirmLogout, setConfirmLogout] = useState(false)
  // Refresh /auth/me into the session (role, verification) on every admin
  // mount; the session user below is the render source.
  useMe()
  const user = useSessionUser()
  const { pathname } = useLocation()

  useEffect(() => {
    AOS.init({ duration: 700, once: true, offset: 80, easing: 'ease-out-cubic' })
  }, [])

  if (needsEmailVerification(user)) {
    return <Navigate to={VERIFY_EMAIL_PATH} replace />
  }
  if (user && !canSeeAdminPortal(user.type)) {
    return <Navigate to="/dashboard" replace />
  }
  if (user && isCollaborator(user.type) && !collaboratorMayOpen(pathname)) {
    return <Navigate to="/admin" replace />
  }

  return (
    <DashboardShell
      sidebar={<AdminSidebar onLogout={() => setConfirmLogout(true)} />}
    >
      <AdminTopBar title={title} subtitle={subtitle} />
      {children}
      <ConfirmModal
        open={confirmLogout}
        title="Log out?"
        message="You will be signed out of the admin portal."
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
  )
}
