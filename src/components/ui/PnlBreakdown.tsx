import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { fmtMediumDate, fmtSignedMoney } from '../../lib/format'

/**
 * A P&L figure shown BEFORE exchange fees, with the plain-words breakdown
 * behind it:
 *
 *     Before fees      +$203.62
 *     Exchange fees     −$14.15
 *     After fees       +$189.48
 *
 * Wrap the big number in <PnlBreakdown>; the popover opens on hover / focus
 * (mouse, keyboard) and on tap (touch — there is no hover on a phone). It is
 * portaled to <body> and positioned from the trigger's rect, because the
 * places it lives in clip overflow (the metrics rail) or animate with a
 * transform (every AOS card), either of which would trap or hide it.
 *
 * `fees` is derived, never passed: gross − net is the only fee figure that is
 * guaranteed to reconcile with the two numbers above and below it. When part
 * of the total predates the fee ledger (`feesSince` set), the last line says
 * so — earlier trades carry no fee on record, so before == after for them
 * and the fee line is "fees we know of", not "fees paid".
 */

export interface PnlBreakdownProps {
  gross: number
  net: number
  /** 'YYYY-MM-DD' — set when some of the trades summed carry no fee record. */
  feesSince?: string | null
  /** Optional first line, e.g. a date or a period name. */
  heading?: string
  /** Trailing note under the three lines. */
  note?: string
  /** Mouse hover only — no focus ring, no tap-to-pin, no dotted underline.
   *  For a figure that already sits inside a button (a calendar cell), where
   *  the tap has its own job and the popup it opens shows the breakdown. */
  hoverOnly?: boolean
  className?: string
  children: ReactNode
}

const ROW = 'flex items-baseline justify-between gap-5 whitespace-nowrap'

export default function PnlBreakdown({
  gross,
  net,
  feesSince = null,
  heading,
  note,
  hoverOnly = false,
  className = '',
  children,
}: PnlBreakdownProps) {
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false) // opened by tap: stays until dismissed
  const anchorRef = useRef<HTMLSpanElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const id = useId()

  const fees = gross - net
  const visible = open || pinned

  useLayoutEffect(() => {
    if (!visible) return
    const anchor = anchorRef.current?.getBoundingClientRect()
    const pop = popRef.current?.getBoundingClientRect()
    if (!anchor || !pop) return
    const gutter = 8
    // Below the number by default; above when it would run off the bottom.
    let top = anchor.bottom + 6
    if (top + pop.height > window.innerHeight - gutter) top = anchor.top - pop.height - 6
    // Left-aligned with the number, clamped to the viewport.
    let left = anchor.left
    if (left + pop.width > window.innerWidth - gutter) left = window.innerWidth - gutter - pop.width
    if (left < gutter) left = gutter
    setPos({ top, left })
  }, [visible, gross, net])

  // A pinned (tapped) popover closes on any tap elsewhere or on Escape.
  useEffect(() => {
    if (!pinned) return
    const away = (e: PointerEvent) => {
      if (anchorRef.current?.contains(e.target as Node)) return
      if (popRef.current?.contains(e.target as Node)) return
      setPinned(false)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPinned(false)
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', key)
    }
  }, [pinned])

  return (
    <>
      <span
        ref={anchorRef}
        tabIndex={hoverOnly ? undefined : 0}
        aria-describedby={visible ? id : undefined}
        className={
          hoverOnly
            ? `inline-flex ${className}`
            : `inline-flex cursor-help underline decoration-dotted decoration-1 underline-offset-[5px] decoration-[color-mix(in_srgb,currentColor_45%,transparent)] outline-none focus-visible:decoration-solid ${className}`
        }
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') setOpen(true)
        }}
        onPointerLeave={() => setOpen(false)}
        onFocus={hoverOnly ? undefined : () => setOpen(true)}
        onBlur={hoverOnly ? undefined : () => setOpen(false)}
        onClick={hoverOnly ? undefined : () => setPinned((p) => !p)}
      >
        {children}
      </span>
      {visible &&
        createPortal(
          <div
            ref={popRef}
            id={id}
            role="tooltip"
            className={`fixed z-[70] min-w-[210px] rounded-card border border-border bg-surface2/97 px-3.5 py-3 text-[12px] shadow-[0_14px_36px_rgba(0,0,0,0.28)] backdrop-blur-sm animate-[fadeup_0.18s_ease-out]${
              pinned ? '' : ' pointer-events-none'
            }`}
            style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}
          >
            {heading && (
              <div className="mb-2 font-mono text-[10.5px] tracking-[0.4px] text-faint uppercase">
                {heading}
              </div>
            )}
            <div className="flex flex-col gap-1.5 font-mono">
              <div className={ROW}>
                <span className="text-muted">Before fees</span>
                <span className={`font-extrabold ${gross < 0 ? 'text-red' : 'text-green'}`}>
                  {fmtSignedMoney(gross)}
                </span>
              </div>
              <div className={ROW}>
                <span className="text-muted">Exchange fees</span>
                <span className="font-bold text-text">
                  {fees === 0 ? '$0.00' : fmtSignedMoney(-fees)}
                </span>
              </div>
              <div className={`${ROW} border-t border-hair pt-1.5`}>
                <span className="text-muted">After fees</span>
                <span className={`font-extrabold ${net < 0 ? 'text-red' : 'text-green'}`}>
                  {fmtSignedMoney(net)}
                </span>
              </div>
            </div>
            {(feesSince || note) && (
              <div className="mt-2 max-w-[240px] whitespace-normal text-[10.5px] leading-[1.45] text-faint">
                {note}
                {note && feesSince ? ' ' : ''}
                {feesSince &&
                  `Fees are recorded from ${fmtMediumDate(feesSince)}; earlier trades show the same figure before and after.`}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
