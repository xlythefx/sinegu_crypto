/**
 * Pure helpers behind `hooks/useUrlFilters.ts` — filter values kept in the
 * URL's query string. No React.
 *
 * Rules:
 * - Only the keys named in `defaults` are filters; every other param (`?tab=`,
 *   `?view=`, …) belongs to the page and is copied through untouched.
 * - A value equal to its default is never written, so an unfiltered page has
 *   a clean URL and a shared link carries only what was actually narrowed.
 * - A value outside a key's `allowed` list (an old link, a typo) reads as the
 *   default rather than as a choice no control can display.
 */

export type FilterValues = Record<string, string>

/** Optional whitelist per key; a key left out accepts any string. */
export type AllowedValues<T extends FilterValues> = { [K in keyof T]?: readonly string[] }

function isAllowed<T extends FilterValues>(
  key: keyof T,
  value: string,
  allowed?: AllowedValues<T>,
): boolean {
  const list = allowed?.[key]
  return !list || list.includes(value)
}

/** The filter values the URL holds, defaults filling every gap. */
export function readFilters<T extends FilterValues>(
  params: URLSearchParams,
  defaults: T,
  allowed?: AllowedValues<T>,
): T {
  const out: T = { ...defaults }
  for (const key of Object.keys(defaults) as (keyof T & string)[]) {
    const raw = params.get(key)
    if (raw === null || !isAllowed(key, raw, allowed)) continue
    out[key] = raw as T[keyof T & string]
  }
  return out
}

/**
 * A copy of `params` with `patch` applied. Unknown keys in the patch are
 * ignored; any filter key left at its default (or holding a value the page
 * would not accept) is dropped, so stale `?exchange=all` links tidy themselves
 * on the next change.
 */
export function writeFilters<T extends FilterValues>(
  params: URLSearchParams,
  patch: Partial<T>,
  defaults: T,
  allowed?: AllowedValues<T>,
): URLSearchParams {
  const next = new URLSearchParams(params)
  for (const key of Object.keys(patch)) {
    if (!(key in defaults)) continue
    const value = patch[key]
    if (value === undefined) next.delete(key)
    else next.set(key, value)
  }
  for (const key of Object.keys(defaults) as (keyof T & string)[]) {
    const value = next.get(key)
    if (value !== null && (value === defaults[key] || !isAllowed(key, value, allowed))) {
      next.delete(key)
    }
  }
  return next
}

/** A copy of `params` with every filter key removed; other params kept. */
export function clearFilters<T extends FilterValues>(
  params: URLSearchParams,
  defaults: T,
): URLSearchParams {
  const next = new URLSearchParams(params)
  for (const key of Object.keys(defaults)) next.delete(key)
  return next
}

/** How many filters differ from their default. */
export function countActive<T extends FilterValues>(filters: T, defaults: T): number {
  return (Object.keys(defaults) as (keyof T)[]).filter((k) => filters[k] !== defaults[k]).length
}
