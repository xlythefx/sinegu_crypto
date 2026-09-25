import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Eye,
  History,
  MoreHorizontal,
  Pencil,
  PlugZap,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AdminApiKey } from '../../types/admin'

interface MenuAction {
  key: string
  label: string
  hint: string
  icon: LucideIcon
  danger?: boolean
  /** Present = the item renders greyed out and says why. */
  disabledReason?: string | null
  onSelect: () => void
}

interface ApiKeyActionsMenuProps {
  apiKey: AdminApiKey
  rechecking: boolean
  onViewOwner: () => void
  onRecheck: () => void
  onEdit: () => void
  onLedger: () => void
  onDisconnect: () => void
  onPurge: () => void
}

const MENU_WIDTH = 264

/**
 * The row's actions, collapsed into one menu.
 *
 * Portalled and positioned from the trigger's rect, like {@link RolePicker}:
 * the table lives in an `overflow-x-auto` wrapper inside an `overflow-hidden`
 * card, which clips anything positioned inside the cell.
 *
 * "Delete permanently" is always listed, never hidden — an action that appears
 * and disappears between rows reads as a bug. When the server says the row is
 * not purgeable, the item is disabled and shows its reason, so the rule is
 * learnable from the UI instead of discovered by a 422.
 */
export default function ApiKeyActionsMenu({
  apiKey: k,
  rechecking,
  onViewOwner,
  onRecheck,
  onEdit,
  onLedger,
  onDisconnect,
  onPurge,
}: ApiKeyActionsMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null)

  const gone = Boolean(k.deleted_at)

  const actions: MenuAction[] = [
    ...(k.owner.uni_id
      ? [
          {
            key: 'owner',
            label: 'View owner',
            hint: k.owner.email ?? 'Open their profile',
            icon: Eye,
            onSelect: onViewOwner,
          },
        ]
      : []),
    ...(!gone && k.key_blocked
      ? [
          {
            key: 'recheck',
            label: rechecking ? 'Rechecking…' : 'Recheck with exchange',
            hint: 'A fixed IP allow-list clears the fault immediately',
            icon: RefreshCw,
            onSelect: onRecheck,
          },
        ]
      : []),
    // Binance only: it is the one venue whose full ledger the engine reads.
    ...(!gone && k.exchange === 'binance'
      ? [
          {
            key: 'ledger',
            label: 'Transfer history',
            hint: 'Match deposits and the starting balance to Binance',
            icon: History,
            onSelect: onLedger,
          },
        ]
      : []),
    ...(!gone
      ? [
          {
            key: 'edit',
            label: 'Edit',
            hint: 'Rename, enable or disable',
            icon: Pencil,
            onSelect: onEdit,
          },
          {
            key: 'disconnect',
            label: 'Disconnect',
            hint: 'Stops trading, keeps the history',
            icon: PlugZap,
            danger: true,
            onSelect: onDisconnect,
          },
        ]
      : []),
    {
      key: 'purge',
      label: 'Delete permanently',
      hint: 'Erases the row and its market data from the database',
      icon: Trash2,
      danger: true,
      disabledReason: k.purgeable ? null : k.purge_blocked_reason,
      onSelect: onPurge,
    },
  ]

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const box = triggerRef.current.getBoundingClientRect()
    const height = 64 + actions.length * 52
    const below = box.bottom + 6
    const top =
      below + height > window.innerHeight && box.top > height
        ? box.top - height - 6
        : below
    // Right-aligned to the trigger — this is the last column.
    const left = Math.min(box.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 12)
    setRect({ top, left: Math.max(12, left) })
  }, [open, actions.length])

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
        className={`inline-flex items-center gap-1.5 rounded-pill border py-1.5 px-3 text-[12px] font-bold cursor-pointer transition ${
          open
            ? 'border-accent-line bg-accent-soft text-accent'
            : 'border-border bg-surface2 text-muted hover:border-accent-line hover:text-accent'
        }`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${k.name}`}
      >
        Actions
        <MoreHorizontal size={14} />
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[1000] rounded-card border border-border bg-surface p-1.5 shadow-[0_18px_44px_rgba(0,0,0,0.4)] animate-[fadeup_0.16s_ease-out]"
            style={{ top: rect.top, left: rect.left, width: MENU_WIDTH }}
          >
            <p className="truncate px-2.5 pt-1.5 pb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
              {k.name}
            </p>
            {actions.map((action) => {
              const disabled = Boolean(action.disabledReason)
              return (
                <button
                  key={action.key}
                  type="button"
                  role="menuitem"
                  disabled={disabled}
                  title={action.disabledReason ?? undefined}
                  className={`w-full flex items-start gap-2.5 rounded-[10px] py-2 px-2.5 text-left transition-colors duration-150 ${
                    disabled
                      ? 'cursor-not-allowed opacity-45'
                      : action.danger
                        ? 'cursor-pointer text-red hover:bg-[color-mix(in_srgb,var(--red)_10%,transparent)]'
                        : 'cursor-pointer text-text hover:bg-surface2'
                  }`}
                  onClick={() => {
                    if (disabled) return
                    setOpen(false)
                    action.onSelect()
                  }}
                >
                  <span className="w-[15px] flex-shrink-0 pt-[3px]">
                    <action.icon
                      size={14}
                      className={
                        action.key === 'recheck' && rechecking
                          ? 'animate-spin'
                          : undefined
                      }
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold leading-tight">
                      {action.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-[1.4] text-muted">
                      {action.disabledReason ?? action.hint}
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
