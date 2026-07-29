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
  Share2,
} from 'lucide-react'
import { usePortalSwitch } from '../ui/PortalSwitchOverlay'
import {
  RAIL,
  BRAND,
  BRAND_LOGO,
  BRAND_TEXT,
  BRAND_TITLE,
  BRAND_SUB,
  NAV,
  ITEM_BASE,
  ITEM_OFF,
  ITEM_ON,
  ITEM_ICON,
  FOOTER,
  ADMIN_SWITCH,
  LOGOUT,
  REVEAL,
} from '../dashboard/shellClasses'

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
  { label: 'Affiliate', url: '/admin/referrals', icon: Share2 },
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
    <aside className={RAIL}>
      <Link to="/" className={BRAND} aria-label="SineguAlerts home">
        <img className={BRAND_LOGO} src="/assets/logo.png" alt="" />
        <span className={BRAND_TEXT}>
          <span className={BRAND_TITLE}>SineguAlerts</span>
          <span className={BRAND_SUB}>Admin Portal</span>
        </span>
      </Link>

      <nav className={NAV}>
        {ADMIN_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === '/admin'}
            className={({ isActive }) =>
              `${ITEM_BASE} ${isActive ? ITEM_ON : ITEM_OFF}`
            }
          >
            <span className={ITEM_ICON}>
              <item.icon size={20} strokeWidth={2} />
            </span>
            <span className={REVEAL}>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className={FOOTER}>
        <button
          type="button"
          className={ADMIN_SWITCH}
          onClick={() => switchPortal('/dashboard', 'Trader Portal')}
        >
          <span className={ITEM_ICON}>
            <Home size={20} strokeWidth={2} />
          </span>
          <span className={REVEAL}>My Dashboard</span>
        </button>
        <button type="button" className={LOGOUT} onClick={onLogout}>
          <span className={ITEM_ICON}>
            <LogOut size={20} strokeWidth={2} />
          </span>
          <span className={REVEAL}>Log out</span>
        </button>
      </div>
    </aside>
  )
}
