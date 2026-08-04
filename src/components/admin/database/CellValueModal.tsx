import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { MONO_PANE } from './classes'

interface CellValueModalProps {
  open: boolean
  column: string
  value: string
  onClose: () => void
}

/**
 * Full-value viewer for a truncated grid cell. Separate from InfoModal, which is
 * centered prose with a single CTA — a 40 KB JSON blob needs a wide, scrollable
 * monospace pane instead. Same backdrop/panel recipe as ConfirmModal, including
 * the portal (AOS transforms on ancestor cards would otherwise trap `fixed`).
 */
export default function CellValueModal({
  open,
  column,
  value,
  onClose,
}: CellValueModalProps) {
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
      className="fixed inset-0 bg-[rgba(0,0,0,0.55)] backdrop-blur-[3px] flex justify-center overflow-y-auto p-6 z-[1000] animate-[fadeup_0.2s_ease_both]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Value of ${column}`}
    >
      <div
        className="bg-surface border border-border rounded-[20px] p-6 max-w-[720px] w-full my-auto shadow-[0_30px_80px_rgba(0,0,0,0.35)] animate-[fadeup_0.25s_cubic-bezier(0.2,0.7,0.2,1)_both]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-3.5">
          <div className="min-w-0">
            <h3 className="font-display text-[17px] font-extrabold tracking-[-0.02em] text-text break-all">
              {column}
            </h3>
            <p className="text-[12px] text-muted mt-px">
              {value.length.toLocaleString()} characters
            </p>
          </div>
          <button
            type="button"
            className="grid place-items-center w-8 h-8 flex-none rounded-[9px] border border-border bg-surface2 text-muted cursor-pointer hover:text-text"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <pre className={`${MONO_PANE} max-h-[60vh] m-0`}>{value}</pre>
      </div>
    </div>,
    document.body,
  )
}
