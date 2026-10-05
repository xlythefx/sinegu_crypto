import { useEffect, useRef, useState } from 'react'

/**
 * Glides a number from where it is to `target` whenever `target` changes, so
 * a figure that moves (a new date range, a refetch) visibly travels to its new
 * value instead of snapping. `startFrom` makes the FIRST render count up from
 * that value too (a modal's totals counting up from 0 as it opens); without it
 * the first render shows `target` as-is.
 *
 * Honours `prefers-reduced-motion`: the value then jumps straight to target.
 * The returned number is for display only — never feed it back into maths.
 */
export function useTween(target: number, duration = 650, startFrom?: number): number {
  const [value, setValue] = useState(startFrom ?? target)
  const current = useRef(startFrom ?? target)

  useEffect(() => {
    const from = current.current
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const span = reduce || !Number.isFinite(from) || from === target ? 0 : duration

    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = span === 0 ? 1 : Math.min((now - start) / span, 1)
      // easeOutCubic — fast off the mark, settles gently on the figure.
      const eased = 1 - Math.pow(1 - p, 3)
      const v = p === 1 ? target : from + (target - from) * eased
      current.current = v
      setValue(v)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}
