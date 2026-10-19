import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown } from 'lucide-react'
import { streakSentence } from '../../../lib/streakLabel'
import type { TradeStreak } from '../../../types/dashboard'

const POPOVER_WIDTH = 252
const POPOVER_HEIGHT = 196

/** 40 → "40", 0.125 → "0.125" — a typed ladder size, without padding zeros. */
function trim(n: number): string {
  return String(Number(n.toFixed(6)))
}

/**
 * The Size column's yellow ↓: this position or trade was opened SMALLER than
 * normal because of a losing streak. Click it for the details — the run, the
 * ladder step, and the step's size against the base size it replaced.
 *
 * Portalled and placed from the trigger's rect (like RolePicker): the table
 * sits in an `overflow-x-auto` wrapper that would clip an absolute popover.
 */
export default function DownsizeButton({ streak }: { streak: TradeStreak }) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const box = triggerRef.current.getBoundingClientRect()
    // Right-aligned to the icon (the column is right-aligned); flip above
    // near the bottom of the screen, never past either edge.
    const below = box.bottom + 6
    const top =
      below + POPOVER_HEIGHT > window.innerHeight && box.top > POPOVER_HEIGHT
        ? box.top - POPOVER_HEIGHT - 6
        : below
    const left = Math.min(box.right - POPOVER_WIDTH, window.innerWidth - POPOVER_WIDTH - 12)
    setRect({ top, left: Math.max(12, left) })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (popRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    // Any scroll moves the trigger out from under a fixed popover, so close.
    const onScroll = () => setOpen(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  const { size, base_size: base, step, kind } = streak
  const hasSizes = size != null && base != null && base > 0
  const cut = hasSizes ? Math.round(((base - size) / base) * 100) : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`inline-grid place-items-center w-5 h-5 flex-none rounded-full border border-accent-line text-accent cursor-pointer transition-colors ${
          open ? 'bg-accent text-on-accent' : 'bg-accent-soft hover:brightness-125'
        }`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Downsized — show details"
        title="Downsized by streak sizing"
      >
        <ArrowDown size={12} strokeWidth={2.75} />
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label="Downsize details"
            className="fixed z-[1000] rounded-card border border-border bg-surface p-3.5 text-left shadow-[0_18px_44px_rgba(0,0,0,0.4)] animate-[fadeup_0.16s_ease-out]"
            style={{ top: rect.top, left: rect.left, width: POPOVER_WIDTH }}
          >
            <p className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
              <ArrowDown size={12} strokeWidth={2.75} />
              Downsized
            </p>
            <p className="mt-2 text-[12px] leading-snug text-muted whitespace-normal">
              {streakSentence(streak)}
            </p>

            {hasSizes && (
              <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-[12px]">
                <dt className="text-faint">Normal size</dt>
                <dd className="font-mono text-text text-right">{trim(base)}</dd>
                <dt className="text-faint">Size used</dt>
                <dd className="font-mono font-bold text-accent text-right">
                  {trim(size)}
                  {cut !== null && cut > 0 && (
                    <span className="ml-1.5 font-semibold text-faint">−{cut}%</span>
                  )}
                </dd>
                {step != null && (
                  <>
                    <dt className="text-faint">Ladder step</dt>
                    <dd className="font-mono text-text text-right">
                      after {step} {kind === 'loss' ? (step === 1 ? 'loss' : 'losses') : step === 1 ? 'win' : 'wins'}
                    </dd>
                  </>
                )}
              </dl>
            )}

            {hasSizes && (
              <p className="mt-2.5 border-t border-hair pt-2 text-[10.5px] leading-snug text-faint whitespace-normal">
                Sizes before balance scaling — each account’s entry is then scaled to its balance.
              </p>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
