import { Link, NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  UserCog,
  KeyRound,
  Target,
  Coins,
  Bell,
  FileText,
  Activity,
  Database,
  ServerCog,
  ScrollText,
  FlaskConical,
  Home,
  LogOut,
  Share2,
  ArrowDownToLine,
  ListTodo,
} from 'lucide-react'
import { usePortalSwitch } from '../ui/PortalSwitchOverlay'
import { getUser } from '../../lib/session'
import { isCollaborator, isDeveloper } from '../../lib/roles'
import type { UserRole } from '../../types/auth'
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
  /** Hidden from admin/master — only `developer` accounts see it. */
  developerOnly?: boolean
  /**
   * Visible to the read-only `collaborator` role. Everything else is hidden
   * from them (and AdminLayout redirects those paths) — keep this in step
   * with `collaboratorMayOpen` in lib/roles.ts.
   */
  collaborator?: boolean
}

/** One per-item rule for who sees a nav entry, so the filter is not re-spelled. */
function visibleTo(item: AdminNavItem, role: UserRole | undefined): boolean {
  if (item.developerOnly && !isDeveloper(role)) return false
  if (isCollaborator(role) && !item.collaborator) return false
  return true
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: 'Admin Dashboard', url: '/admin', icon: LayoutDashboard, collaborator: true },
  // The owner's list of things only they can do or decide (lib/adminTodos.ts).
  { label: 'To be Done', url: '/admin/todo', icon: ListTodo },
  { label: 'User Management', url: '/admin/users', icon: UserCog, collaborator: true },
  { label: 'API Keys', url: '/admin/api-keys', icon: KeyRound },
  { label: 'Strategies', url: '/admin/strategies', icon: Target, collaborator: true },
  { label: 'Trading Assets', url: '/admin/assets', icon: Coins },
  { label: 'Sandbox', url: '/admin/sandbox', icon: FlaskConical },
  { label: 'Trading Positions', url: '/admin/positions', icon: Bell },
  { label: 'Bot Engine', url: '/admin/engine', icon: ServerCog },
  { label: 'Signal Log', url: '/admin/trade-logs', icon: ScrollText },
  { label: 'Invoice History', url: '/admin/invoices', icon: FileText },
  // Every admin since the rail went public (TRON_PUBLIC=true on prod
  // 2026-10-02): held payments and disputed claims are worked from here.
  { label: 'Crypto Transfers', url: '/admin/tron-transfers', icon: ArrowDownToLine },
  { label: 'Affiliate', url: '/admin/referrals', icon: Share2 },
  { label: 'System Resources', url: '/admin/resources', icon: Activity },
  { label: 'Database', url: '/admin/database', icon: Database, developerOnly: true },
]

interface AdminSidebarProps {
  onLogout: () => void
}

/** Admin variant of the icon-rail sidebar — same chrome, admin nav + portal switch. */
export default function AdminSidebar({ onLogout }: AdminSidebarProps) {
  const switchPortal = usePortalSwitch()
  const role = getUser()?.type
  const navItems = ADMIN_NAV_ITEMS.filter((item) => visibleTo(item, role))

  return (
    <aside className={RAIL}>
      <Link to="/" className={BRAND} aria-label="Pixel Alpha home">
        <img className={BRAND_LOGO} src="/assets/logo.png" alt="" />
        <span className={BRAND_TEXT}>
          <span className={BRAND_TITLE}>Pixel Alpha</span>
          <span className={BRAND_SUB}>Admin Portal</span>
        </span>
      </Link>

      <nav className={NAV}>
        {navItems.map((item) => (
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
