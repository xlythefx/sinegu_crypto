import { NavLink } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import type { AdminNavGroup as NavGroup, AdminNavItem } from '../../types/adminNav'
import { ITEM_BASE, ITEM_OFF, ITEM_ON, ITEM_ICON, REVEAL } from '../dashboard/shellClasses'

/* A group header sits on the rail like any page link; its pages drop down
   under it. On the collapsed 76px rail only icons show, so a page keeps the
   header's icon column; once the rail widens (hover, or the phone drawer)
   the pages step in, which is what reads as "inside this group". */
// The app loads no Tailwind preflight, so a <button> must shed the browser's
// own background, border, padding and font by hand.
const HEAD = `${ITEM_BASE} w-full pr-3 py-0 text-left cursor-pointer bg-transparent border-0 font-[inherit]`
const HEAD_HERE = 'text-text hover:bg-surface2'
const CHEVRON = 'transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]'
const PANEL =
  'grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]'
const PANEL_OPEN = 'grid-rows-[1fr] opacity-100'
const PANEL_SHUT = 'grid-rows-[0fr] opacity-0'
const PANEL_INNER = 'min-h-0 overflow-hidden flex flex-col gap-1'
const PAGE =
  'flex items-center gap-3 h-[38px] pl-[13px] rounded-nav no-underline font-semibold text-[13px] whitespace-nowrap ' +
  'transition-[background,color,padding] duration-200 group-hover/rail:pl-[25px] max-[900px]:pl-[25px]'

interface Props {
  group: NavGroup
  /** The group's pages this role may see (at least two; one is rendered flat). */
  items: AdminNavItem[]
  /** The current page is one of this group's pages. */
  here: boolean
  open: boolean
  onToggle: () => void
  onHoverStart: () => void
  onHoverCancel: () => void
}

export default function AdminNavGroup({ group, items, here, open, onToggle, onHoverStart, onHoverCancel }: Props) {
  const panelId = `admin-nav-${group.id}`

  return (
    <div
      onPointerEnter={(e) => {
        // Touch has no hover: a tap is a click, and the header toggles.
        if (e.pointerType === 'mouse') onHoverStart()
      }}
      onPointerLeave={onHoverCancel}
    >
      <button
        type="button"
        className={`${HEAD} ${here ? HEAD_HERE : ITEM_OFF}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className={`${ITEM_ICON} ${here ? 'text-accent' : ''}`}>
          <group.icon size={20} strokeWidth={2} />
        </span>
        <span className={`${REVEAL} flex-1`}>{group.label}</span>
        <span className={REVEAL}>
          <ChevronDown size={16} strokeWidth={2.2} className={`${CHEVRON} ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      <div id={panelId} className={`${PANEL} ${open ? PANEL_OPEN : PANEL_SHUT}`} inert={!open}>
        <div className={PANEL_INNER}>
          {/* pt on the first child, not the inner box: padding on a 0fr row would never fully close. */}
          {items.map((item, i) => (
            <NavLink
              key={item.url}
              to={item.url}
              className={({ isActive }) => `${PAGE} ${i === 0 ? 'mt-1' : ''} ${isActive ? ITEM_ON : ITEM_OFF}`}
            >
              <span className={ITEM_ICON}>
                <item.icon size={18} strokeWidth={2} />
              </span>
              <span className={REVEAL}>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  )
}
