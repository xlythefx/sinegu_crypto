import { useEffect, useState } from 'react'
import { getBinanceSizingCheck } from '../services/admin'
import type { BinanceSizingCheckData } from '../types/admin'

export interface BinanceSizingCheckState {
  data: BinanceSizingCheckData | null
  loading: boolean
  error: string | null
  /** Fetch again (Binance prices move; the admin may also have fixed a typo). */
  reload: () => void
}

/**
 * The asset form's Binance check for `ticker`: one request after typing pauses,
 * re-run on `reload`. A newer ticker wins over an older answer that lands late.
 * `ticker` null/short = nothing to check.
 */
export function useBinanceSizingCheck(ticker: string | null): BinanceSizingCheckState {
  const symbol = (ticker ?? '').trim().toUpperCase()
  const [data, setData] = useState<BinanceSizingCheckData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (symbol.length < 2) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }
    let live = true
    setLoading(true)
    const timer = window.setTimeout(() => {
      getBinanceSizingCheck(symbol)
        .then((res) => {
          if (!live) return
          setData(res)
          setError(null)
        })
        .catch((e: unknown) => {
          if (!live) return
          setData(null)
          setError(e instanceof Error ? e.message : 'The check could not be loaded.')
        })
        .finally(() => {
          if (live) setLoading(false)
        })
    }, 600)
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [symbol, reloadKey])

  return { data, loading, error, reload: () => setReloadKey((k) => k + 1) }
}
