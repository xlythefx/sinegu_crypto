import { Link, NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Sparkles,
  Bell,
  Building2,
  DollarSign,
  Coins,
  LineChart,
  Users,
  Settings,
  LogOut,
  Shield,
} from 'lucide-react'
import { getUser } from '../../lib/session'
import { canSeeAdmin } from '../../lib/roles'
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
} from './shellClasses'

export interface TraderNavItem {
  label: string
  url: string
  icon: LucideIcon
  /** Hidden from the sidebar for now (page not ready yet). */
  hidden?: boolean
}

export const NAV_ITEMS: TraderNavItem[] = [
  { label: 'Trading Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { label: 'Performance Analytics', url: '/dashboard/analytics', icon: Sparkles },
  { label: 'Positions', url: '/dashboard/positions', icon: Bell },
  { label: 'Exchange Accounts', url: '/dashboard/exchanges', icon: Building2 },
  { label: 'Billing & Invoices', url: '/dashboard/invoices', icon: DollarSign },
  { label: 'Trading Assets', url: '/dashboard/assets', icon: Coins, hidden: true },
  { label: 'Asset Performance', url: '/dashboard/asset-performance', icon: LineChart },
  { label: 'Referrals', url: '/dashboard/referrals', icon: Users },
  { label: 'Settings', url: '/dashboard/settings', icon: Settings },
]

interface TraderSidebarProps {
  onLogout: () => void
}

/**
 * Collapsible icon-rail sidebar (76px ↔ 246px). Expands on hover via CSS;
 * labels stay in the DOM and fade with opacity. On mobile it renders as a
 * slide-in drawer (always expanded), toggled by the shell's `--drawer-open`.
 */
export default function TraderSidebar({ onLogout }: TraderSidebarProps) {
  const switchPortal = usePortalSwitch()
  // Only staff rows (master/admin/developer) see the admin switch.
  const showAdmin = canSeeAdmin(getUser()?.type)

  return (
    <aside className={RAIL}>
      <Link to="/" className={BRAND} aria-label="SineguAlerts home">
        <img className={BRAND_LOGO} src="/assets/logo.png" alt="" />
        <span className={BRAND_TEXT}>
          <span className={BRAND_TITLE}>SineguAlerts</span>
          <span className={BRAND_SUB}>Trader Portal</span>
        </span>
      </Link>

      <nav className={NAV}>
        {NAV_ITEMS.filter((item) => !item.hidden).map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === '/dashboard'}
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
        {showAdmin && (
          <button
            type="button"
            className={ADMIN_SWITCH}
            onClick={() => switchPortal('/admin', 'Admin Portal')}
          >
            <span className={ITEM_ICON}>
              <Shield size={20} strokeWidth={2} />
            </span>
            <span className={REVEAL}>Admin Dashboard</span>
          </button>
        )}
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
