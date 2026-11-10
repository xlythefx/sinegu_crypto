import { useState } from 'react'
import { useInterval } from './useInterval'

/**
 * The current time, re-read every `intervalMs` while the tab is visible — for
 * countdowns that only need minute precision ("deleted in 6 d 4 h").
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())
  useInterval(() => setNow(Date.now()), intervalMs)
  return now
}
