import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import type { UserRole } from '../../types/admin'
import { RoleBadge } from './badges'

interface RoleOption {
  key: UserRole
  label: string
  hint: string
}

const ROLE_OPTIONS: RoleOption[] = [
  { key: 'user', label: 'User', hint: 'Trader — no admin access' },
  { key: 'admin', label: 'Admin', hint: 'Admin portal, business tools' },
  { key: 'master', label: 'Master', hint: 'The house account — only one' },
  { key: 'developer', label: 'Developer', hint: 'Database console + test payments' },
]

interface RolePickerProps {
  role: UserRole
  /**
   * Own row. You may re-role yourself, but not down to `user` — that revokes
   * the access you would need to undo it, so that one option is locked (and
   * refused server-side too).
   */
  isSelf?: boolean
  onSelect: (role: UserRole) => void
}

/**
 * The role cell of the users table, clickable.
 *
 * The menu is portalled and positioned from the trigger's rect rather than
 * absolutely inside the cell: the table sits in an `overflow-x-auto` wrapper
 * inside an `overflow-hidden` card, which would otherwise clip it.
 */
export default function RolePicker({ role, isSelf, onSelect }: RolePickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const box = triggerRef.current.getBoundingClientRect()
    const MENU_WIDTH = 232
    const MENU_HEIGHT = 236
    // Flip above / pull left when the trigger sits near an edge.
    const below = box.bottom + 6
    const top =
      below + MENU_HEIGHT > window.innerHeight && box.top > MENU_HEIGHT
        ? box.top - MENU_HEIGHT - 6
        : below
    const left = Math.min(box.left, window.innerWidth - MENU_WIDTH - 12)
    setRect({ top, left: Math.max(12, left) })
  }, [open])

  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return
      }
      setOpen(false)
    }
    // Any scroll moves the trigger out from under a fixed menu, so close.
    const onScroll = () => setOpen(false)

    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex items-center gap-1.5 rounded-pill border border-transparent py-1 px-1.5 -ml-1.5 cursor-pointer transition-[background-color,border-color] duration-150 hover:border-border hover:bg-surface2"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Change role"
      >
        {role === 'user' ? (
          <span className="text-[12px] text-muted">User</span>
        ) : (
          <RoleBadge role={role} />
        )}
        <ChevronDown size={13} className="text-faint" />
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[1000] w-[232px] rounded-card border border-border bg-surface p-1.5 shadow-[0_18px_44px_rgba(0,0,0,0.4)] animate-[fadeup_0.16s_ease-out]"
            style={{ top: rect.top, left: rect.left }}
          >
            <p className="px-2.5 pt-1.5 pb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
              Set role
            </p>
            {ROLE_OPTIONS.map((option) => {
              const locked = isSelf === true && option.key === 'user'

              return (
                <button
                  key={option.key}
                  type="button"
                  role="menuitem"
                  disabled={locked}
                  className={`w-full flex items-start gap-2 rounded-[10px] py-2 px-2.5 text-left transition-colors duration-150 ${
                    locked
                      ? 'cursor-not-allowed opacity-45'
                      : option.key === role
                        ? 'cursor-pointer bg-accent-soft text-accent'
                        : 'cursor-pointer text-text hover:bg-surface2'
                  }`}
                  onClick={() => {
                    setOpen(false)
                    if (option.key !== role) onSelect(option.key)
                  }}
                >
                  <span className="w-[14px] flex-shrink-0 pt-[3px] text-accent">
                    {option.key === role && <Check size={13} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold leading-tight">
                      {option.label}
                    </span>
                    <span className="block text-[11px] text-muted leading-[1.4] mt-0.5">
                      {locked ? 'You cannot demote yourself' : option.hint}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </>
  )
}
