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

  // Which deps the data currently on screen was fetched for. Every consumer
  // renders `{data ? … : <DataState error …/>}`, so data that outlives a FAILED
  // request is data shown with no error beside it — and when the deps are a
  // filter, it is last filter's numbers under this filter's label. Selecting
  // an exchange whose request 500s looked exactly like "the filter does
  // nothing", while the page kept showing another venue's money.
  //
  // Only a deps change invalidates it: a manual reload() or a poll re-requests
  // the SAME thing, so keeping the current data through a transient failure
  // there is right (and stops an auto-refreshing page blanking on one blip).
  const dataDeps = useRef<string | null>(null)
  let depsKey: string
  try {
    depsKey = JSON.stringify(deps)
  } catch {
    depsKey = String(deps.length) // unserializable deps: fall back to "same"
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetcherRef
      .current()
      .then((result) => {
        if (cancelled) return
        dataDeps.current = depsKey
        setData(result)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err)
        if (dataDeps.current !== depsKey) setData(null)
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
