import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  UserCog,
  KeyRound,
  Target,
  Coins,
  Layers,
  FileText,
  Gauge,
  History,
  Database,
  ServerCog,
  ScrollText,
  FlaskConical,
  Home,
  LogOut,
  Share2,
  ArrowDownToLine,
  ListTodo,
  Webhook,
  Siren,
  Eye,
  Bot,
  Clapperboard,
  Swords,
  BellRing,
  Users,
  TrendingUp,
  Wallet,
  Megaphone,
  Settings,
} from 'lucide-react'
import { usePortalSwitch } from '../ui/PortalSwitchOverlay'
import { getUser } from '../../lib/session'
import { isCollaborator, isDeveloper } from '../../lib/roles'
import type { UserRole } from '../../types/auth'
import { isNavGroup, type AdminNavEntry, type AdminNavItem } from '../../types/adminNav'
import { useNavGroups } from '../../hooks/useNavGroups'
import AdminNavGroup from './AdminNavGroup'
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

/** One per-item rule for who sees a nav entry, so the filter is not re-spelled. */
function visibleTo(item: AdminNavItem, role: UserRole | undefined): boolean {
  if (item.developerOnly && !isDeveloper(role)) return false
  if (isCollaborator(role) && !item.collaborator) return false
  return true
}

/** Same rule NavLink applies: `/admin` only exactly, every other page with its sub-pages. */
function isHere(url: string, pathname: string): boolean {
  if (url === '/admin') return pathname === '/admin' || pathname === '/admin/'
  return pathname === url || pathname.startsWith(`${url}/`)
}

/*
 * Grouped on the owner's request (2026-11-25: "so it doesn't seem so many").
 * Customers / Money / System match the Admin Dashboard's own tab names. A new
 * page joins the group it belongs to; only Dashboard and To be Done sit on
 * top. A group a role sees ONE page of renders that page flat, and a group it
 * sees none of is not drawn.
 */
const ADMIN_NAV: AdminNavEntry[] = [
  { label: 'Admin Dashboard', url: '/admin', icon: LayoutDashboard, collaborator: true },
  // The owner's list of things only they can do or decide (lib/adminTodos.ts).
  { label: 'To be Done', url: '/admin/todo', icon: ListTodo },
  {
    id: 'customers',
    label: 'Customers',
    icon: Users,
    items: [
      { label: 'User Management', url: '/admin/users', icon: UserCog, collaborator: true },
      // Customers' names, P&L and balances: full admins only, like the API.
      { label: 'Customers vs Master', url: '/admin/vs-master', icon: Swords },
      { label: 'API Keys', url: '/admin/api-keys', icon: KeyRound },
      // Every user's own actions, sign-ins and admin actions in one list — full admins (Dima, 2026-11-23).
      { label: 'Activity', url: '/admin/activity', icon: History },
      { label: 'Affiliate', url: '/admin/referrals', icon: Share2 },
    ],
  },
  {
    id: 'trading',
    label: 'Trading',
    icon: TrendingUp,
    items: [
      { label: 'Strategies', url: '/admin/strategies', icon: Target, collaborator: true },
      { label: 'Trading Assets', url: '/admin/assets', icon: Coins },
      { label: 'Positions', url: '/admin/positions', icon: Layers },
      { label: 'Signal Log', url: '/admin/trade-logs', icon: ScrollText },
    ],
  },
  {
    id: 'money',
    label: 'Money',
    icon: Wallet,
    items: [
      { label: 'Invoice History', url: '/admin/invoices', icon: FileText },
      // Every admin since the rail went public (TRON_PUBLIC=true on prod
      // 2026-10-02): held payments and disputed claims are worked from here.
      { label: 'Crypto Transfers', url: '/admin/tron-transfers', icon: ArrowDownToLine },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    items: [
      // The public website's traffic — every staff role, IP included (owner, 2026-10-28).
      { label: 'Visitors', url: '/admin/visitors', icon: Eye, collaborator: true },
      // X / TikTok planning + Higgsfield generations — the marketing team's page, and
      // the ONE admin area a collaborator may write in (owner, 2026-11-10).
      { label: 'Creatives', url: '/admin/creatives', icon: Clapperboard, collaborator: true },
    ],
  },
  {
    id: 'system',
    label: 'System',
    icon: Settings,
    items: [
      { label: 'Bot Engine', url: '/admin/engine', icon: ServerCog },
      { label: 'Error Bot', url: '/admin/error-bot', icon: Siren },
      // Every engine address (main + test feed) with copyable links — full admins only.
      { label: 'Webhooks', url: '/admin/webhooks', icon: Webhook },
      { label: 'System Resources', url: '/admin/resources', icon: Gauge },
      // Who receives each team email — full admins (Dima, 2026-11-23).
      { label: 'Notifications', url: '/admin/notifications', icon: BellRing },
      // Keys for the read-only AI connector (the employer's Grok) + what it asked — full admins only.
      { label: 'AI Access', url: '/admin/ai-access', icon: Bot },
      { label: 'Sandbox', url: '/admin/sandbox', icon: FlaskConical },
      { label: 'Database', url: '/admin/database', icon: Database, developerOnly: true },
    ],
  },
]

function NavItem({ item }: { item: AdminNavItem }) {
  return (
    <NavLink
      to={item.url}
      end={item.url === '/admin'}
      className={({ isActive }) => `${ITEM_BASE} ${isActive ? ITEM_ON : ITEM_OFF}`}
    >
      <span className={ITEM_ICON}>
        <item.icon size={20} strokeWidth={2} />
      </span>
      <span className={REVEAL}>{item.label}</span>
    </NavLink>
  )
}

interface AdminSidebarProps {
  onLogout: () => void
}

/** Admin variant of the icon-rail sidebar — same chrome, grouped admin nav + portal switch. */
export default function AdminSidebar({ onLogout }: AdminSidebarProps) {
  const switchPortal = usePortalSwitch()
  const role = getUser()?.type
  const { pathname } = useLocation()
  const groups = useNavGroups()

  return (
    <aside className={RAIL} onPointerLeave={groups.leaveRail}>
      <Link to="/" className={BRAND} aria-label="Pixel Alpha home">
        <img className={BRAND_LOGO} src="/assets/logo.png" alt="" />
        <span className={BRAND_TEXT}>
          <span className={BRAND_TITLE}>Pixel Alpha</span>
          <span className={BRAND_SUB}>Admin Portal</span>
        </span>
      </Link>

      <nav className={NAV}>
        {ADMIN_NAV.map((entry) => {
          if (!isNavGroup(entry)) {
            return visibleTo(entry, role) ? <NavItem key={entry.url} item={entry} /> : null
          }
          const items = entry.items.filter((item) => visibleTo(item, role))
          if (items.length === 0) return null
          if (items.length === 1) return <NavItem key={items[0].url} item={items[0]} />
          const here = items.some((item) => isHere(item.url, pathname))
          return (
            <AdminNavGroup
              key={entry.id}
              group={entry}
              items={items}
              here={here}
              open={groups.isOpen(entry.id, here)}
              onToggle={() => groups.toggle(entry.id, here)}
              onHoverStart={() => groups.hoverStart(entry.id)}
              onHoverCancel={groups.hoverCancel}
            />
          )
        })}
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
