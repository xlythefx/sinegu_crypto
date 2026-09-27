import { useEffect, useRef } from 'react'

interface PollOptions {
  /**
   * Whether returning to the tab fires a tick immediately. True for data — what
   * the reader sees should be current, not however old the last poll before
   * they switched away was. False for anything that only advances a display
   * (a rotation), where an immediate tick on return is a jump, not a refresh.
   */
  immediateOnResume?: boolean
  /** Hold the timer without unmounting — e.g. while the pointer is over the card. */
  paused?: boolean
}

/**
 * Run `tick` every `intervalMs`, but only while the tab is visible and not
 * paused.
 *
 * The visibility pause is the point: a landing page left open in a background
 * tab would otherwise spend its share of the `/public/*` rate limit forever
 * and keep waking an endpoint nobody is looking at.
 *
 * `tick` may be an inline closure — the latest one is always used, so the
 * interval is not torn down and restarted on every render.
 */
export function usePoll(
  tick: () => void,
  intervalMs: number,
  { immediateOnResume = true, paused = false }: PollOptions = {},
): void {
  const tickRef = useRef(tick)
  tickRef.current = tick

  useEffect(() => {
    if (paused) return

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
        if (immediateOnResume) tickRef.current()
        start()
      }
    }

    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs, immediateOnResume, paused])
}
