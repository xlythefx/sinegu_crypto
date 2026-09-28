import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Loader2, X } from 'lucide-react'
import { toPng } from 'html-to-image'
import PnlShareCard from './PnlShareCard'
import { buildPnlCard, PNL_CARD_PERIODS, type PnlCardDay, type PnlCardPeriod } from '../../../lib/pnlCard'
import { captureFileName } from '../../../lib/capture'

interface PnlCardModalProps {
  open: boolean
  onClose: () => void
  /** The user's calendar days (same map the page's P&L calendar shows). */
  days: Record<string, PnlCardDay>
  /** Which venue those days cover, printed on the card. */
  venue: string
}

const CHIP =
  'rounded-pill border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors cursor-pointer'

function download(dataUrl: string, fileName: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/**
 * Generator for the shareable P&L card: pick a period, preview, download a
 * PNG. The card never carries a name or a dollar figure (lib/pnlCard.ts), so
 * it is safe to post for any account.
 */
export default function PnlCardModal({ open, onClose, days, venue }: PnlCardModalProps) {
  const [period, setPeriod] = useState<PnlCardPeriod>('today')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const stats = useMemo(() => buildPnlCard(days, period), [days, period])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const save = async () => {
    const node = cardRef.current
    if (!node) return
    setBusy(true)
    setError(null)
    const label = PNL_CARD_PERIODS.find((p) => p.key === period)?.label ?? period
    try {
      let url: string
      try {
        url = await toPng(node, { pixelRatio: 3, cacheBust: true })
      } catch (err) {
        // Google Fonts could not be inlined — still hand over an image.
        console.warn('P&L card: capture with embedded fonts failed; retrying without.', err)
        url = await toPng(node, { pixelRatio: 3, cacheBust: true, skipFonts: true })
      }
      download(url, captureFileName('pnl card', label))
    } catch {
      setError('Could not create the image. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="P&L card"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-[500px] flex-col overflow-y-auto rounded-card border border-border bg-surface p-5 shadow-[0_30px_80px_rgba(0,0,0,0.45)] animate-[dtm-in_0.2s_cubic-bezier(0.2,0.7,0.2,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="font-display text-[17px] font-extrabold">P&L card</div>
            <div className="mt-0.5 text-[12.5px] text-muted">
              Percentages only, after fees · no name or amounts, safe to post
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-[30px] w-[30px] flex-none items-center justify-center rounded-btn border border-border bg-surface2 text-muted hover:border-accent hover:text-text"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Period">
          {PNL_CARD_PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={period === p.key}
              className={`${CHIP} ${
                period === p.key
                  ? 'border-accent-line bg-accent-soft text-accent'
                  : 'border-border bg-surface2 text-muted hover:text-text'
              }`}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* The card is a fixed 420px image; a phone previews it zoomed down. */}
        <div className="flex justify-center">
          <div key={period} className="animate-[fadeup_0.35s_ease-out] max-[480px]:[zoom:0.78]">
            <PnlShareCard ref={cardRef} stats={stats} venue={venue} />
          </div>
        </div>

        {error && (
          <p className="mt-3 text-center text-[12.5px] text-red" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-btn bg-accent px-5 text-[13.5px] font-bold text-on-accent disabled:opacity-60"
          onClick={save}
          disabled={busy}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {busy ? 'Creating image…' : 'Download PNG'}
        </button>
      </div>
    </div>,
    document.body,
  )
}
