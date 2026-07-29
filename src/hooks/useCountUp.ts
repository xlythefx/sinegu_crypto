import { useEffect, useRef, useState } from 'react'

/**
 * Counts from 0 → `target` once the element scrolls into view. Returns the ref
 * to attach and the current animated value. Used by the v2 landing metrics.
 */
export function useCountUp(target: number, duration = 1600) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [value, setValue] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || started.current) return
        started.current = true
        const start = performance.now()
        const tick = (now: number) => {
          const p = Math.min((now - start) / duration, 1)
          // easeOutCubic
          const eased = 1 - Math.pow(1 - p, 3)
          setValue(target * eased)
          if (p < 1) requestAnimationFrame(tick)
          else setValue(target)
        }
        requestAnimationFrame(tick)
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [target, duration])

  return { ref, value }
}
