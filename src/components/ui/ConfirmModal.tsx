import { useEffect } from 'react'
import './ConfirmModal.css'

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

  return (
    <div
      className="confirm-modal__overlay"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="confirm-modal__title">{title}</h3>
        {message && <p className="confirm-modal__message">{message}</p>}
        <div className="confirm-modal__actions">
          <button className="confirm-modal__cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={`confirm-modal__confirm${danger ? ' confirm-modal__confirm--danger' : ''}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
