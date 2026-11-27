import { useCallback, useEffect, useRef, useState } from 'react'
import { stepAtLine, stepInPin } from '../lib/scrollStep'

/** The stacked (phone) layout of the steps — the same breakpoint as the list's classes. */
const PHONE = '(max-width: 960px)'
/** How far the reader scrolls for the highlight to move one step while pinned. */
export const STEP_SCROLL_PX = 140
/** The pinned list needs this much room left on the screen, or it is not pinned. */
const PIN_MARGIN_PX = 48
/** Not pinned, a stacked step is "being read" once its top passes this share of the screen. */
const READING_LINE = 0.6

/**
 * The step a reader has scrolled to, for the home page's "What happens when
 * the strategy trades" on a PHONE (Dima, 2026-11-27: "this card should be
 * static but when you scroll the yellow should go down each scroll").
 *
 * - `pinned`: a phone, and the whole list fits on the screen. The caller then
 *   gives `trackRef` the height of the screen plus STEP_SCROLL_PX per step and
 *   makes its child sticky, so the list holds still while every
 *   STEP_SCROLL_PX of scroll moves the highlight down one step.
 * - A phone whose screen is too short for the list: no pin, the highlight
 *   follows each step past a reading line instead.
 * - A wide screen: `pinned` false; the caller shows no highlight there (the
 *   wide strip is static and white, owner's choice the same morning).
 *
 * Measured on scroll and resize, one read per frame; `lib/scrollStep` decides.
 */
export function useScrollStep(count: number) {
  const listRef = useRef<HTMLOListElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const items = useRef<(HTMLElement | null)[]>([])
  const [active, setActive] = useState(0)
  const [pinned, setPinned] = useState(false)

  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const list = listRef.current
      if (!list) return
      const height = window.innerHeight
      const phone = window.matchMedia(PHONE).matches
      const canPin = phone && list.offsetHeight <= height - PIN_MARGIN_PX
      setPinned(canPin)
      const track = trackRef.current?.getBoundingClientRect()
      if (canPin && track && track.height > height) {
        setActive(stepInPin(track.top, track.height, height, count))
      } else {
        const tops = items.current.slice(0, count).map((el) => el?.getBoundingClientRect().top ?? Infinity)
        setActive(stepAtLine(tops, height * READING_LINE))
      }
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

  // A change of `pinned` changes the track's height: measure again once it has.
  useEffect(() => {
    const id = requestAnimationFrame(() => window.dispatchEvent(new Event('scroll')))
    return () => cancelAnimationFrame(id)
  }, [pinned])

  const itemRef = useCallback(
    (i: number) => (el: HTMLElement | null) => {
      items.current[i] = el
    },
    [],
  )

  return { active, pinned, listRef, trackRef, itemRef }
}
