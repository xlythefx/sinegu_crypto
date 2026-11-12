import { useEffect, useState } from 'react'
import { checkPositionLimit } from '../services/admin'
import { getApiErrorMessage } from '../services/api'
import type { PositionLimitData } from '../types/admin'

export interface PositionLimitState {
  data: PositionLimitData | null
  loading: boolean
  error: string | null
  reload: () => void
}

/**
 * The asset form's Binance position-limit check for the PROPOSED size: one
 * request after typing pauses (it spends a Binance read via the engine), re-run
 * on `reload`. A newer proposal wins over an older answer that lands late.
 * `ticker` null = nothing to check (not a Binance coin).
 */
export function usePositionLimit(input: {
  ticker: string | null
  baseSize: number
  maxPosition: number
  leverage: number | null
}): PositionLimitState {
  const symbol = (input.ticker ?? '').trim().toUpperCase()
  const { baseSize, maxPosition, leverage } = input
  const [data, setData] = useState<PositionLimitData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (symbol.length < 2 || !(baseSize > 0)) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }
    let live = true
    setLoading(true)
    const timer = window.setTimeout(() => {
      checkPositionLimit({ ticker: symbol, baseSize, maxPosition: maxPosition > 0 ? maxPosition : 0, leverage })
        .then((res) => {
          if (!live) return
          setData(res)
          setError(null)
        })
        .catch((e: unknown) => {
          if (!live) return
          setData(null)
          setError(getApiErrorMessage(e, 'The position limit could not be checked.'))
        })
        .finally(() => {
          if (live) setLoading(false)
        })
    }, 800)
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [symbol, baseSize, maxPosition, leverage, reloadKey])

  return { data, loading, error, reload: () => setReloadKey((k) => k + 1) }
}
