import { useCallback, useEffect, useRef, useState } from 'react'
import { stepAtLine, stepByTravel, stepInPin } from '../lib/scrollStep'

/** A stacked step is "being read" once its top passes this share of the screen. */
const READING_LINE = 0.6
/** Side by side and not pinned, the highlight sweeps while the list's top rises from here… */
const TRAVEL_FROM = 0.82
/** …to here (shares of the screen height). */
const TRAVEL_TO = 0.28

/**
 * The step of a list the reader has scrolled to. Measures on scroll and
 * resize (one read per frame) and lets `lib/scrollStep` decide:
 * - stacked steps (a phone) light up as each passes the reading line;
 * - steps side by side inside a PINNED track (`trackRef` taller than the
 *   screen, its content sticky) follow the track's own scroll, so the strip
 *   stays still while the highlight moves (owner, 2026-11-27);
 * - side by side with no pin, the list's travel up the screen sweeps them.
 *
 * Attach `listRef` to the list, `itemRef(i)` to each step and, for the pinned
 * layout, `trackRef` to the tall element whose child sticks.
 */
export function useScrollStep(count: number) {
  const listRef = useRef<HTMLOListElement>(null)
  const trackRef = useRef<HTMLElement>(null)
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
      const track = trackRef.current?.getBoundingClientRect()
      let next: number
      if (stacked) next = stepAtLine(tops, height * READING_LINE)
      else if (track && track.height > height) next = stepInPin(track.top, track.height, height, count)
      else next = stepByTravel(list.getBoundingClientRect().top, height * TRAVEL_FROM, height * TRAVEL_TO, count)
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

  return { active, listRef, trackRef, itemRef }
}
