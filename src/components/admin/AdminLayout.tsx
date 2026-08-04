import { useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Menu } from 'lucide-react'
import AOS from 'aos'
import 'aos/dist/aos.css'
import DashboardShell, { ShellContext } from '../dashboard/DashboardShell'
import AdminSidebar from './AdminSidebar'
import ConfirmModal from '../ui/ConfirmModal'
import UserAvatar from '../ui/UserAvatar'
import { useTheme } from '../../theme'
import { useSessionUser } from '../../hooks/useSessionUser'
import { canSeeAdmin } from '../../lib/roles'
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
 * Chrome + client-side guard for admin pages. Only user_credentials rows with
 * type master/admin/developer may enter; plain users bounce to their dashboard.
 * (Cosmetic gate only — real enforcement lives in the API's admin middleware.)
 */
export default function AdminLayout({
  title,
  subtitle,
  children,
}: AdminLayoutProps) {
  const navigate = useNavigate()
  const [confirmLogout, setConfirmLogout] = useState(false)
  const user = useSessionUser()

  useEffect(() => {
    AOS.init({ duration: 700, once: true, offset: 80, easing: 'ease-out-cubic' })
  }, [])

  if (user && !canSeeAdmin(user.type)) {
    return <Navigate to="/dashboard" replace />
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
          } finally {
            navigate('/auth')
          }
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </DashboardShell>
  )
}
