import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, QrCode, TriangleAlert, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

interface TronQrModalProps {
  open: boolean
  address: string
  /** Already formatted for display ("3.00"). */
  amount: string
  asset: string
  chainLabel: string
  onClose: () => void
}

const COPY_BTN =
  'flex-shrink-0 inline-flex items-center gap-1.5 rounded-btn border border-border bg-surface py-1.5 px-2.5 text-[11.5px] font-bold text-text cursor-pointer transition-[border-color] duration-150 hover:border-accent'

/**
 * The receiving address as a scannable QR, in its own dialog stacked above the
 * address window (z 1020 > 1010), so a phone camera gets the whole screen.
 *
 * The QR carries the bare ADDRESS only. TRON wallet URI support for an amount
 * is inconsistent, and a QR that silently drops the amount would send the
 * wrong figure under amount matching — so the amount is restated beside it as
 * something to type, never encoded.
 */
export default function TronQrModal({
  open,
  address,
  amount,
  asset,
  chainLabel,
  onClose,
}: TronQrModalProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [address])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[1020] flex justify-center overflow-y-auto p-4 max-[420px]:p-3 sm:p-6 bg-[var(--bgScrim)] backdrop-blur-[4px] animate-[fadeup_0.2s_ease_both]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${chainLabel} address QR code`}
    >
      <div
        className="relative w-full max-w-[400px] my-auto flex flex-col bg-surface border border-border rounded-[20px] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex gap-3 items-center p-5 pr-14 max-[420px]:p-4 max-[420px]:pr-12 border-b border-hair">
          <span className="w-[38px] h-[38px] flex-shrink-0 grid place-items-center rounded-[11px] bg-[var(--bubble)] border border-accent-line text-accent">
            <QrCode size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-[17px] font-extrabold tracking-[-0.01em] leading-tight">
              Scan to pay
            </h3>
            <p className="text-[11.5px] text-muted mt-0.5">{chainLabel} address</p>
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

        <div className="p-5 max-[420px]:p-4 flex flex-col items-center gap-4">
          {/* Fixed white quiet zone, never theme tokens: scanners need
              dark-on-light contrast in either theme. */}
          <div className="rounded-[16px] bg-white p-4">
            <QRCodeSVG
              value={address}
              size={216}
              level="M"
              bgColor="#ffffff"
              fgColor="#0b0d12"
              title={`${chainLabel} address ${address}`}
            />
          </div>

          <div className="w-full">
            <p className="text-[10.5px] uppercase tracking-[0.1em] text-faint mb-1.5">Address</p>
            <div className="flex items-center gap-2 rounded-[10px] border border-accent-line bg-surface2 py-2.5 px-3">
              <code className="flex-1 min-w-0 font-mono text-[11.5px] text-text break-all">{address}</code>
              <button type="button" className={COPY_BTN} onClick={copy}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <p className="w-full rounded-[10px] border border-accent-line bg-accent-soft py-2.5 px-3 text-[12px] text-muted leading-[1.5]">
            The QR fills in the address only. Please send the exact amount:{' '}
            <strong className="font-mono text-accent">
              {amount} {asset}
            </strong>
          </p>

          <p className="w-full flex items-start gap-2 text-[11.5px] font-semibold text-red leading-[1.45]">
            <TriangleAlert size={14} className="flex-shrink-0 mt-px" />
            <span className="min-w-0">
              Send on the <strong>TRON (TRC-20)</strong> network only.
            </span>
          </p>
        </div>

        <footer className="border-t border-hair p-4 flex justify-end">
          <button
            type="button"
            className="text-[13.5px] font-semibold bg-surface2 text-text border border-border py-2.5 px-[22px] rounded-pill cursor-pointer transition-[border-color] duration-150 hover:border-accent max-[430px]:w-full"
            onClick={onClose}
          >
            Back
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
