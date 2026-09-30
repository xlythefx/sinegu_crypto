import { createPortal } from 'react-dom'
import { Landmark, X } from 'lucide-react'
import type { TronIntent, TronSettlement } from '../../types/payments'
import TronPayPanel from './TronPayPanel'

interface TronAddressModalProps {
  /** Whether the modal is on screen. The panel stays MOUNTED either way. */
  open: boolean
  intent: TronIntent
  developer: boolean
  onClose: () => void
  onSettled: (settlement: TronSettlement) => void
}

/**
 * The wallet address and exact amount, in their own dialog above the pay sheet.
 *
 * Closing it only HIDES it: the panel stays mounted, so it keeps polling the
 * intent and the invoice still flips to paid while the trader is back on the
 * sheet (or copying the address into their exchange). Reopening shows the same
 * reserved amount and countdown — no new quote is minted.
 */
export default function TronAddressModal({
  open,
  intent,
  developer,
  onClose,
  onSettled,
}: TronAddressModalProps) {
  return createPortal(
    <div
      className={`fixed inset-0 z-[1010] flex justify-center overflow-y-auto p-4 max-[420px]:p-3 sm:p-6 bg-[var(--bgScrim)] backdrop-blur-[4px] ${
        open ? 'animate-[fadeup_0.2s_ease_both]' : 'hidden'
      }`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      aria-label={`Send ${intent.asset} on ${intent.chainLabel}`}
    >
      <div
        className="relative w-full max-w-[480px] my-auto flex flex-col max-h-[calc(100vh-2rem)] bg-surface border border-border rounded-[20px] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex-shrink-0 flex gap-3 items-center p-5 pr-14 max-[420px]:p-4 max-[420px]:pr-12 border-b border-hair">
          <span className="w-[38px] h-[38px] flex-shrink-0 grid place-items-center rounded-[11px] bg-[var(--bubble)] border border-accent-line text-accent">
            <Landmark size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-[17px] font-extrabold tracking-[-0.01em] leading-tight">
              Payment address
            </h3>
            <p className="text-[11.5px] text-muted mt-0.5">
              Close this any time — you can open it again from the invoice.
            </p>
          </div>
          <button
            type="button"
            className="absolute top-4 right-4 w-8 h-8 grid place-items-center rounded-btn bg-transparent text-faint cursor-pointer transition-colors duration-150 hover:bg-surface2 hover:text-text"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto p-5 max-[420px]:p-4">
          <TronPayPanel intent={intent} developer={developer} onSettled={onSettled} />
        </div>

        <footer className="flex-shrink-0 border-t border-hair p-4 flex justify-end">
          <button
            type="button"
            className="text-[13.5px] font-semibold bg-surface2 text-text border border-border py-2.5 px-[22px] rounded-pill cursor-pointer transition-[border-color] duration-150 hover:border-accent max-[430px]:w-full"
            onClick={onClose}
          >
            Close
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
