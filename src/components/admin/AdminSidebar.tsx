import { Link, NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  UserCog,
  Target,
  Coins,
  Bell,
  FileText,
  Activity,
  Settings,
  FlaskConical,
  Home,
  LogOut,
} from 'lucide-react'
import { usePortalSwitch } from '../ui/PortalSwitchOverlay'

export interface AdminNavItem {
  label: string
  url: string
  icon: LucideIcon
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: 'Admin Dashboard', url: '/admin', icon: LayoutDashboard },
  { label: 'User Management', url: '/admin/users', icon: UserCog },
  { label: 'Strategies', url: '/admin/strategies', icon: Target },
  { label: 'Trading Assets', url: '/admin/assets', icon: Coins },
  { label: 'Sandbox', url: '/admin/sandbox', icon: FlaskConical },
  { label: 'Trading Positions', url: '/admin/positions', icon: Bell },
  { label: 'Invoice History', url: '/admin/invoices', icon: FileText },
  { label: 'System Resources', url: '/admin/resources', icon: Activity },
  { label: 'Settings', url: '/admin/settings', icon: Settings },
]

interface AdminSidebarProps {
  onLogout: () => void
}

/** Admin variant of the icon-rail sidebar — same chrome, admin nav + portal switch. */
export default function AdminSidebar({ onLogout }: AdminSidebarProps) {
  const switchPortal = usePortalSwitch()

  return (
    <aside className="dsb">
      <Link to="/" className="dsb__brand" aria-label="SineguAlerts home">
        <img className="dsb__logo" src="/assets/logo.png" alt="" />
        <span className="dsb__brand-text">
          <span className="dsb__brand-title">SineguAlerts</span>
          <span className="dsb__brand-sub">Admin Portal</span>
        </span>
      </Link>

      <nav className="dsb__nav">
        {ADMIN_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === '/admin'}
            className={({ isActive }) =>
              `dsb__item${isActive ? ' dsb__item--active' : ''}`
            }
          >
            <span className="dsb__item-icon">
              <item.icon size={20} strokeWidth={2} />
            </span>
            <span className="dsb__label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="dsb__footer">
        <button
          type="button"
          className="dsb__admin-switch"
          onClick={() => switchPortal('/dashboard', 'Trader Portal')}
        >
          <span className="dsb__item-icon">
            <Home size={20} strokeWidth={2} />
          </span>
          <span className="dsb__label">My Dashboard</span>
        </button>
        <button type="button" className="dsb__logout" onClick={onLogout}>
          <span className="dsb__item-icon">
            <LogOut size={20} strokeWidth={2} />
          </span>
          <span className="dsb__label">Log out</span>
        </button>
      </div>
    </aside>
  )
}
