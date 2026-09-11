import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A hidden gesture lock: `unlocked` flips true once `tap()` has been called
 * `taps` times inside a rolling `windowMs`. Pass `resetKey` to re-lock when the
 * surface it guards goes away (a modal closing, a different record opening).
 *
 * Only the timestamps inside the window are kept, so a slow sequence never
 * accumulates — a burst is the whole point of the gesture.
 */
export function useTapUnlock(taps = 8, windowMs = 3000, resetKey?: unknown) {
  const [unlocked, setUnlocked] = useState(false)
  const stamps = useRef<number[]>([])

  useEffect(() => {
    stamps.current = []
    setUnlocked(false)
  }, [resetKey])

  const tap = useCallback(() => {
    const now = Date.now()
    stamps.current = [...stamps.current.filter((t) => now - t <= windowMs), now]
    if (stamps.current.length >= taps) {
      stamps.current = []
      setUnlocked(true)
    }
  }, [taps, windowMs])

  return { unlocked, tap }
}
