import { useCallback, useState } from 'react'
import { useInterval } from './useInterval'

/**
 * Whole seconds left until a deadline, ticking once a second; `start(n)` sets
 * a new deadline n seconds from now. Measured against the clock rather than
 * decremented, so it stays right while the tab is hidden (useInterval pauses
 * then) — e.g. while the user is off in their mail app fetching a code.
 */
export function useCountdown(initialSeconds = 0) {
  const [deadline, setDeadline] = useState(() => Date.now() + initialSeconds * 1000)
  const [now, setNow] = useState(() => Date.now())

  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000))

  useInterval(() => setNow(Date.now()), remaining > 0 ? 1000 : null)

  const start = useCallback((seconds: number) => {
    const t = Date.now()
    setNow(t)
    setDeadline(t + Math.max(0, seconds) * 1000)
  }, [])

  return { remaining, start }
}
