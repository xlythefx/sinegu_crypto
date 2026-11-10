import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface CreativeModalProps {
  open: boolean
  title: string
  subtitle?: ReactNode
  onClose: () => void
  /** Panel width cap (default 640). */
  maxWidth?: number
  children: ReactNode
}

/**
 * The form-modal shell for this page (plan editor, budget cap). Portaled into
 * <body> like ConfirmModal — the triggers sit inside AOS cards, whose
 * `transform` would trap a fixed overlay. Scrolls as a whole on a short phone
 * screen; the close button has its own space so a long title never touches it.
 */
export default function CreativeModal({
  open,
  title,
  subtitle,
  onClose,
  maxWidth = 640,
  children,
}: CreativeModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex animate-[fadeup_0.2s_ease_both] justify-center overflow-y-auto bg-black/55 p-3 backdrop-blur-[3px] sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="my-auto w-full animate-[fadeup_0.25s_cubic-bezier(0.2,0.7,0.2,1)_both] rounded-[20px] border border-border bg-surface p-5 shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:p-7"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-[20px] font-extrabold tracking-[-0.02em] text-text">{title}</h3>
            {subtitle && <p className="mt-1 text-[13px] leading-[1.55] text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 inline-flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-btn text-muted transition-colors duration-150 hover:bg-surface2 hover:text-text"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
