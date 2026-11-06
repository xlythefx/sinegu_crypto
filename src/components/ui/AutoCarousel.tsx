import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface AutoCarouselProps {
  children: ReactNode
  /** What the row holds, for screen readers and the arrows' labels ("Assets"). */
  label: string
  /** Milliseconds between automatic steps. */
  interval?: number
}

/** How long a manual scroll or arrow press holds the automatic roll back. */
const IDLE_AFTER_USER_MS = 8000
/** Pixel tolerance for "at the start / at the end" (sub-pixel scroll widths). */
const EDGE = 2

const ARROW =
  'w-8 h-8 flex-none flex items-center justify-center rounded-full border border-border bg-surface2 text-muted cursor-pointer transition-colors duration-150 hover:text-text hover:border-accent-line'

/**
 * One row of items that slides sideways instead of wrapping: an arrow on each
 * side, swipe on touch, and an automatic step to the next item every
 * `interval` ms. At the end it rewinds to the start; the arrows wrap the same
 * way. Items are never duplicated to fake an endless loop — they are often
 * buttons (the dashboard's asset toggles), and two copies of one control is
 * a trap for a screen reader.
 *
 * The roll stops whenever someone could be reaching for an item: while the
 * pointer is over the row, while focus is inside it, and for a few seconds
 * after any arrow press or manual scroll. It never runs when everything fits
 * (no arrows either), when the tab is in the background, or for a visitor
 * who asked the system for reduced motion.
 */
export default function AutoCarousel({ children, label, interval = 3000 }: AutoCarouselProps) {
  const viewport = useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = useState(false)
  const hovered = useRef(false)
  const focused = useRef(false)
  const resumeAt = useRef(0)
  const count = Children.count(children)

  // Re-measured when the row resizes and when the number of items changes
  // (By Asset ⇄ By Strategy swaps the whole list).
  useEffect(() => {
    const el = viewport.current
    if (!el) return
    const measure = () => setOverflowing(el.scrollWidth > el.clientWidth + EDGE)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [count])

  /** Scroll so the next (or previous) item starts at the left edge. */
  const step = useCallback((dir: 1 | -1) => {
    const el = viewport.current
    if (!el) return
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0
    const starts = (Array.from(el.children) as HTMLElement[]).map((item) => item.offsetLeft - pad)
    const max = el.scrollWidth - el.clientWidth
    const x = el.scrollLeft
    let target: number
    if (dir === 1) {
      const next = starts.find((s) => s > x + EDGE)
      target = x >= max - EDGE || next === undefined ? 0 : Math.min(next, max)
    } else {
      const prev = [...starts].reverse().find((s) => s < x - EDGE)
      target = x <= EDGE ? max : (prev ?? 0)
    }
    el.scrollTo({ left: target, behavior: 'smooth' })
  }, [])

  const holdOff = useCallback(() => {
    resumeAt.current = Date.now() + IDLE_AFTER_USER_MS
  }, [])

  useEffect(() => {
    if (!overflowing) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => {
      if (hovered.current || focused.current || document.hidden) return
      if (Date.now() < resumeAt.current) return
      step(1)
    }, interval)
    return () => window.clearInterval(id)
  }, [overflowing, interval, step])

  const arrow = (dir: 1 | -1) =>
    overflowing && (
      <button
        type="button"
        className={ARROW}
        aria-label={`${dir === 1 ? 'Next' : 'Previous'} — ${label}`}
        onClick={() => {
          holdOff()
          step(dir)
        }}
      >
        {dir === 1 ? <ChevronRight size={16} strokeWidth={2.4} /> : <ChevronLeft size={16} strokeWidth={2.4} />}
      </button>
    )

  return (
    <div
      className="flex items-center gap-2"
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onPointerEnter={(e) => {
        // A finger "enters" on tap and leaves on lift — only a mouse hovers.
        if (e.pointerType === 'mouse') hovered.current = true
      }}
      onPointerLeave={() => {
        hovered.current = false
      }}
      onFocus={() => {
        focused.current = true
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) focused.current = false
      }}
    >
      {arrow(-1)}
      <div
        ref={viewport}
        // Vertical padding keeps an item's focus/selection ring inside the
        // scroll box, which clips on both axes once it scrolls on one.
        className="relative flex-1 min-w-0 flex gap-2 overflow-x-auto py-[3px] px-0.5 snap-x snap-proximity [&>*]:snap-start [&>*]:flex-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onWheel={holdOff}
        onTouchStart={holdOff}
        onPointerDown={holdOff}
      >
        {children}
      </div>
      {arrow(1)}
    </div>
  )
}
