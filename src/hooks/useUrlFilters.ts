import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  clearFilters,
  countActive,
  readFilters,
  writeFilters,
  type AllowedValues,
  type FilterValues,
} from '../lib/urlFilters'

export interface UrlFilterOptions<T extends FilterValues> {
  /** Accepted values per key; anything else in the URL reads as the default. */
  allowed?: AllowedValues<T>
}

export interface UrlFilters<T extends FilterValues> {
  filters: T
  set: (key: keyof T, value: string) => void
  /** Several keys in ONE history entry — use it whenever one action moves more than one filter. */
  setMany: (patch: Partial<T>) => void
  /** Put one key back to its default (an active-filter chip's ✕). */
  reset: (key: keyof T) => void
  /** Every filter key back to its default; the page's other params stay. */
  clear: () => void
  activeCount: number
  isActive: (key: keyof T) => boolean
}

/**
 * Filter state kept in the URL's query string, so a reload, the back button
 * or a link pasted to a colleague lands on the same view.
 *
 *   const { filters, set } = useUrlFilters({ exchange: 'all', q: '', date: 'all' })
 *
 * - A value equal to its default is removed from the URL (clean links).
 * - Params that are not filters (`?tab=`, `?view=`) are never touched.
 * - Writes REPLACE the history entry: filtering is not navigation, and Back
 *   should leave the page rather than undo each keystroke.
 * - `defaults` may be an inline object literal — it is compared by value.
 *
 * Writes are based on the latest URL this hook produced, not the one from the
 * last render, so two `set` calls in one handler (or a debounced search firing
 * from an older render) compose instead of the second erasing the first.
 */
export function useUrlFilters<T extends FilterValues>(
  defaults: T,
  options: UrlFilterOptions<T> = {},
): UrlFilters<T> {
  const [params, setParams] = useSearchParams()

  // Callers pass literals; key them by value so identities stay stable.
  const defaultsKey = JSON.stringify(defaults)
  const allowedKey = JSON.stringify(options.allowed ?? null)
  const base = useMemo(() => JSON.parse(defaultsKey) as T, [defaultsKey])
  const allowed = useMemo(
    () => (JSON.parse(allowedKey) as AllowedValues<T> | null) ?? undefined,
    [allowedKey],
  )

  const filters = useMemo(() => readFilters(params, base, allowed), [params, base, allowed])

  const latest = useRef(params)
  useEffect(() => {
    latest.current = params
  }, [params])

  const write = useCallback(
    (next: URLSearchParams) => {
      if (next.toString() === latest.current.toString()) return
      latest.current = next
      setParams(next, { replace: true })
    },
    [setParams],
  )

  const setMany = useCallback(
    (patch: Partial<T>) => write(writeFilters(latest.current, patch, base, allowed)),
    [write, base, allowed],
  )
  const set = useCallback(
    (key: keyof T, value: string) => setMany({ [key]: value } as Partial<T>),
    [setMany],
  )
  const reset = useCallback(
    (key: keyof T) => setMany({ [key]: base[key] } as Partial<T>),
    [setMany, base],
  )
  const clear = useCallback(() => write(clearFilters(latest.current, base)), [write, base])
  const isActive = useCallback((key: keyof T) => filters[key] !== base[key], [filters, base])

  return {
    filters,
    set,
    setMany,
    reset,
    clear,
    activeCount: countActive(filters, base),
    isActive,
  }
}
