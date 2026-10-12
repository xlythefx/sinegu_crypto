import { useCallback, useEffect, useState } from 'react'
import { ACCOUNT_STEPS, CONNECT_STEPS } from '../lib/binanceGuide'

/** Where the reader's ticks live — this device only, a convenience. */
const PROGRESS_KEY = 'pa-binance-guide-done'
/** "I already have a Binance account" — Part 1 folded away. */
const HAS_ACCOUNT_KEY = 'pa-binance-guide-has-account'

function readDone(): string[] {
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY)
    const ids = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

/**
 * A reader with no stored answer who has already ticked Part 2 steps came
 * here before Part 1 existed — they have Binance, so Part 1 starts folded
 * rather than greeting them with four unticked steps they never needed.
 */
function readHasAccount(done: string[]): boolean {
  try {
    const raw = window.localStorage.getItem(HAS_ACCOUNT_KEY)
    if (raw !== null) return raw === '1'
  } catch {
    /* storage unavailable — fall through to the inference */
  }
  const ticked = (ids: { id: string }[]) => ids.some((s) => done.includes(s.id))
  return ticked(CONNECT_STEPS) && !ticked(ACCOUNT_STEPS)
}

/**
 * Ticked-off steps and the Part 1 skip, remembered on this device so a reader
 * who leaves for Binance mid-way comes back to where they were. Storage can be
 * missing or throw (private window, blocked site data) — the page works
 * without it.
 */
export function useGuideProgress() {
  const [done, setDone] = useState<string[]>(readDone)
  const [hasAccount, setHasAccount] = useState<boolean>(() => readHasAccount(readDone()))

  useEffect(() => {
    try {
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(done))
    } catch {
      /* storage unavailable — progress lasts for this visit only */
    }
  }, [done])

  useEffect(() => {
    try {
      window.localStorage.setItem(HAS_ACCOUNT_KEY, hasAccount ? '1' : '0')
    } catch {
      /* storage unavailable — the choice lasts for this visit only */
    }
  }, [hasAccount])

  const toggle = useCallback((id: string, value?: boolean) => {
    setDone((prev) => {
      const on = value ?? !prev.includes(id)
      return on ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)
    })
  }, [])

  const reset = useCallback(() => setDone([]), [])

  return { done, toggle, reset, hasAccount, setHasAccount }
}
