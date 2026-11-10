import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type PanelPlacement = 'docked' | 'sheet' | 'wide'

interface PanelShellProps {
  placement: PanelPlacement
  title: string
  icon: LucideIcon
  onClose: () => void
  /** Extra header buttons (Plans: Expand / Collapse). */
  actions?: ReactNode
  /** Changes when the content is swapped — the body replays its reveal. */
  contentKey: string
  children: ReactNode
}

const HEADER = 'flex min-h-[60px] flex-none items-center gap-3 border-b border-hair px-4 py-2.5 sm:px-5'
const CLOSE =
  'inline-flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-btn text-muted transition-colors duration-150 hover:bg-surface hover:text-text'

/**
 * AOS reveals on window scroll; a panel scrolls on its own, so anything with
 * `data-aos` below its fold would never appear. Inside a panel those reveals
 * are switched off (shown at once) — the keyed fade-up of the body is the
 * reveal instead.
 */
const NO_AOS = '[&_[data-aos]]:opacity-100! [&_[data-aos]]:transform-none!'

/**
 * The frame every Creatives panel sits in, in one of three placements:
 * - docked (≥ 1280px): a column beside the chat, sticky and full height, with
 *   its own scroll — the chat stays usable next to it;
 * - sheet (below 1280px): a full-height sheet over the chat from the right,
 *   full screen on a phone, with a backdrop that closes it;
 * - wide (Plans → Expand): a near-full-screen overlay for the whole board.
 * Sheets and the wide overlay are portaled into <body> (the chat sits under
 * AOS transforms), lock the page's scroll and close on Escape — unless a
 * dialog opened from inside them is up, which owns Escape then.
 */
export default function PanelShell({ placement, title, icon: Icon, onClose, actions, contentKey, children }: PanelShellProps) {
  const overlay = placement !== 'docked'
  const frameRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const closeFn = useRef(onClose)
  closeFn.current = onClose

  useEffect(() => {
    if (!overlay) return
    const root = document.documentElement
    const before = root.style.overflow
    root.style.overflow = 'hidden'
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]'))
      if (dialogs.some((d) => d !== frameRef.current)) return
      closeFn.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      root.style.overflow = before
      window.removeEventListener('keydown', onKey)
    }
  }, [overlay])

  const header = (
    <header className={HEADER}>
      <span
        className="grid h-8 w-8 flex-none place-items-center rounded-[10px] border border-accent-line bg-accent-soft text-accent"
        aria-hidden="true"
      >
        <Icon size={15} />
      </span>
      <h2 className="min-w-0 flex-1 truncate font-display text-[16px] font-extrabold tracking-[-0.01em] text-text">
        {title}
      </h2>
      {actions}
      <button ref={closeRef} type="button" onClick={onClose} aria-label={`Close ${title}`} className={CLOSE}>
        <X size={18} aria-hidden="true" />
      </button>
    </header>
  )

  const body = (
    <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 [scrollbar-width:thin] ${NO_AOS}`}>
      <div key={contentKey} className="animate-[fadeup_0.35s_ease-out] pb-2">
        {children}
      </div>
    </div>
  )

  if (placement === 'docked') {
    return (
      <aside
        aria-label={title}
        className="sticky top-4 flex h-[calc(100dvh-2rem)] w-[440px] flex-none flex-col overflow-hidden rounded-card border border-border bg-surface2 shadow-[0_18px_48px_rgba(0,0,0,0.18)] 2xl:w-[480px]"
      >
        {header}
        {body}
      </aside>
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[900]">
      {/* The backdrop closes it with a click; the header's close button is the accessible way. */}
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
      <div
        ref={frameRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={
          placement === 'wide'
            ? 'absolute inset-0 flex flex-col overflow-hidden bg-surface2 animate-[fadeup_0.25s_cubic-bezier(0.2,0.7,0.2,1)_both] sm:inset-4 sm:rounded-[20px] sm:border sm:border-border sm:shadow-[0_30px_80px_rgba(0,0,0,0.35)] lg:inset-6'
            : 'absolute inset-y-0 right-0 flex w-full flex-col overflow-hidden bg-surface2 animate-[sheetin_0.28s_cubic-bezier(0.2,0.7,0.2,1)_both] sm:w-[min(560px,calc(100%-48px))] sm:border-l sm:border-border sm:shadow-[-24px_0_60px_rgba(0,0,0,0.28)]'
        }
      >
        {header}
        {body}
      </div>
    </div>,
    document.body,
  )
}
