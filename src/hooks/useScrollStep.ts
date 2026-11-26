import { useCallback, useEffect, useRef, useState } from 'react'
import { stepAtLine, stepByTravel } from '../lib/scrollStep'

/** A stacked step is "being read" once its top passes this share of the screen. */
const READING_LINE = 0.6
/** Side by side, the highlight sweeps while the list's top rises from here… */
const TRAVEL_FROM = 0.82
/** …to here (shares of the screen height). */
const TRAVEL_TO = 0.28

/**
 * The step of a list the reader has scrolled to. Measures on scroll and
 * resize (one read per frame) and lets `lib/scrollStep` decide: stacked steps
 * light up as each passes the reading line; steps side by side share a top,
 * so the list's travel up the screen sweeps through them instead.
 *
 * Attach `listRef` to the list and `itemRef(i)` to each step.
 */
export function useScrollStep(count: number) {
  const listRef = useRef<HTMLOListElement>(null)
  const items = useRef<(HTMLElement | null)[]>([])
  const [active, setActive] = useState(0)

  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const list = listRef.current
      if (!list) return
      const height = window.innerHeight
      const tops = items.current.slice(0, count).map((el) => el?.getBoundingClientRect().top ?? Infinity)
      const stacked = tops.length > 1 && Math.abs(tops[tops.length - 1] - tops[0]) > 8
      const next = stacked
        ? stepAtLine(tops, height * READING_LINE)
        : stepByTravel(list.getBoundingClientRect().top, height * TRAVEL_FROM, height * TRAVEL_TO, count)
      setActive(next)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [count])

  const itemRef = useCallback(
    (i: number) => (el: HTMLElement | null) => {
      items.current[i] = el
    },
    [],
  )

  return { active, listRef, itemRef }
}
