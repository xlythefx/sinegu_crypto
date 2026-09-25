import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeftRight, Check, X } from 'lucide-react'
import { fmtMediumDate } from '../../lib/format'
import type { RangePreset } from '../../lib/rangePresets'

interface TransferSegmentsModalProps {
  open: boolean
  segments: RangePreset[]
  /** Id of the segment the current dates match, if any. */
  activeId: string | null
  onPick: (segment: RangePreset) => void
  onClose: () => void
}

/**
 * Pick a stretch of time between two deposits / withdrawals. Inside one, no
 * money moved in or out after its first day, so its return is trading alone.
 *
 * A modal rather than a row of chips: an account with a dozen transfers would
 * otherwise push the card's own figures below the fold. Portalled into <body>
 * because the card animates in with AOS (`transform`), which would trap a
 * fixed overlay inside it.
 */
export default function TransferSegmentsModal({
  open,
  segments,
  activeId,
  onPick,
  onClose,
}: TransferSegmentsModalProps) {
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
      className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4 animate-[fadeup_0.2s_ease_both]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Between transfers"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-[520px] flex-col rounded-[18px] border border-border bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-[22px] pb-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] border border-accent-line bg-accent-soft text-accent">
              <ArrowLeftRight size={16} />
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-[18px] font-extrabold leading-tight">
                Between transfers
              </h3>
              <p className="mt-1 text-[12.5px] leading-[1.5] text-muted">
                Each range starts on a deposit or withdrawal and ends the day before the
                next one — no money moved in between, so its return is trading alone.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] border border-border bg-surface2 text-muted cursor-pointer hover:text-text"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto px-[22px] pb-[22px]">
          {segments.map((s) => {
            const active = s.id === activeId
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onPick(s)}
                className={`flex w-full items-center justify-between gap-3 rounded-[12px] border px-3.5 py-3 text-left cursor-pointer transition-colors ${
                  active
                    ? 'border-accent-line bg-accent-soft'
                    : 'border-hair bg-surface2 hover:border-accent-line'
                }`}
              >
                <span className="min-w-0">
                  <span className={`block text-[13.5px] font-bold ${active ? 'text-accent' : 'text-text'}`}>
                    {s.label}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] text-muted">
                    {fmtMediumDate(s.from)} – {fmtMediumDate(s.to)}
                  </span>
                </span>
                <span className="flex flex-none items-center gap-2.5">
                  {s.detail && (
                    <span
                      className={`font-mono text-[12px] font-bold ${
                        s.tone === 'pos' ? 'text-green' : s.tone === 'neg' ? 'text-red' : 'text-faint'
                      }`}
                    >
                      {s.detail}
                    </span>
                  )}
                  {active && <Check size={15} className="text-accent" />}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
