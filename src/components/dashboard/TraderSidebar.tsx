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
import { usePortalSwitch } from '../ui/PortalSwitchOverlay'

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
  { label: 'Referrals', url: '/dashboard/referrals', icon: Users, hidden: true },
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
  // Only user_credentials rows with type master/admin see the admin switch.
  const role = getUser()?.type
  const canSeeAdmin = role === 'master' || role === 'admin'

  return (
    <aside className="dsb">
      <Link to="/" className="dsb__brand" aria-label="SineguAlerts home">
        <img className="dsb__logo" src="/assets/logo.png" alt="" />
        <span className="dsb__brand-text">
          <span className="dsb__brand-title">SineguAlerts</span>
          <span className="dsb__brand-sub">Trader Portal</span>
        </span>
      </Link>

      <nav className="dsb__nav">
        {NAV_ITEMS.filter((item) => !item.hidden).map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === '/dashboard'}
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
        {canSeeAdmin && (
          <button
            type="button"
            className="dsb__admin-switch"
            onClick={() => switchPortal('/admin', 'Admin Portal')}
          >
            <span className="dsb__item-icon">
              <Shield size={20} strokeWidth={2} />
            </span>
            <span className="dsb__label">Admin Dashboard</span>
          </button>
        )}
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
