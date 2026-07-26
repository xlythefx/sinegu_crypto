import { useCallback, useEffect, useRef, useState } from 'react'

interface ApiDataState<T> {
  data: T | null
  loading: boolean
  error: unknown
  reload: () => void
}

/**
 * Fetch-on-mount helper for service-layer calls.
 * Pass a stable fetcher (module-level service function). Provide `deps` to
 * refetch whenever they change (e.g. filter state); the latest fetcher is
 * always used, so an inline fetcher is fine.
 */
export function useApiData<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): ApiDataState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [tick, setTick] = useState(0)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetcherRef
      .current()
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        if (!cancelled) setError(err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps])

  const reload = useCallback(() => setTick((t) => t + 1), [])

  return { data, loading, error, reload }
}
