import { useEffect, useRef } from 'react'

/**
 * Run `tick` every `intervalMs`, but only while the tab is visible.
 *
 * The pause is the point: a landing page left open in a background tab would
 * otherwise spend its share of the `/public/*` rate limit forever and keep
 * waking an endpoint nobody is looking at. Returning to the tab fires one
 * immediate tick, so what the reader sees is current rather than however old
 * the last poll before they switched away was.
 *
 * `tick` may be an inline closure — the latest one is always used, so the
 * interval is not torn down and restarted on every render.
 */
export function usePoll(tick: () => void, intervalMs: number): void {
  const tickRef = useRef(tick)
  tickRef.current = tick

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined

    const stop = () => {
      if (timer !== undefined) {
        clearInterval(timer)
        timer = undefined
      }
    }

    const start = () => {
      stop()
      timer = setInterval(() => tickRef.current(), intervalMs)
    }

    const onVisibility = () => {
      if (document.hidden) {
        stop()
      } else {
        tickRef.current()
        start()
      }
    }

    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs])
}
