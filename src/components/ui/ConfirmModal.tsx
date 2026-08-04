import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface ConfirmModalProps {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Renders the confirm button in red for destructive actions */
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Standard yes/no confirmation modal — project convention: any significant or
 * destructive action must be confirmed through this before executing.
 *
 * Rendered through a portal into <body>: callers often sit inside a card
 * carrying `data-aos`, and AOS animates with `transform`, which makes that
 * ancestor the containing block for `position: fixed` children — the overlay
 * would be trapped inside the card and clipped.
 *
 * Usage:
 *   const [confirmOpen, setConfirmOpen] = useState(false)
 *   <ConfirmModal
 *     open={confirmOpen}
 *     title="Stop this bot?"
 *     message="Open positions will be closed at market price."
 *     danger
 *     onConfirm={() => { stopBot(); setConfirmOpen(false) }}
 *     onCancel={() => setConfirmOpen(false)}
 *   />
 */
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Yes',
  cancelLabel = 'No',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 bg-[rgba(0,0,0,0.55)] backdrop-blur-[3px] flex justify-center overflow-y-auto p-6 z-[1000] animate-[fadeup_0.2s_ease_both]"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="bg-surface border border-border rounded-[20px] p-7 max-w-[420px] w-full my-auto shadow-[0_30px_80px_rgba(0,0,0,0.35)] animate-[fadeup_0.25s_cubic-bezier(0.2,0.7,0.2,1)_both]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-[20px] font-extrabold tracking-[-0.02em] mb-2 text-text">
          {title}
        </h3>
        {message && (
          <p className="text-[14px] leading-[1.6] text-muted mb-[22px]">
            {message}
          </p>
        )}
        <div className="flex gap-2.5 justify-end">
          <button
            className="text-[14px] font-semibold bg-surface2 text-text border border-border py-[11px] px-[22px] rounded-pill cursor-pointer"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className={`text-[14px] font-bold py-[11px] px-[22px] rounded-pill border-0 cursor-pointer ${
              danger
                ? 'bg-red text-white shadow-[0_10px_24px_rgba(255,90,90,0.25)]'
                : 'bg-accent text-on-accent shadow-[0_10px_24px_var(--glow)]'
            }`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
