import { getToken } from '../lib/session'

/** Local Laravel dev server (`php artisan serve`). */
const DEV_API_URL = 'http://127.0.0.1:8000/api'

/**
 * API base URL resolution — decided at RUNTIME from the host, never baked into
 * the build. One `npm run build` works on localhost, on the bare VPS IP, and on
 * any domain pointed at it later, so no manual switching per deployment.
 *
 *   localhost / 127.0.0.1 / *.local  -> http://127.0.0.1:8000/api (or VITE_API_URL)
 *   any deployed host                -> <same origin>/api
 *
 * Same-origin works because the nginx vhost serves both from one host:
 * `/` -> the React dist, `/api` -> sinegutrade-api/public. That also means TLS
 * comes for free — once certbot runs, the origin is https and so is the API.
 *
 * `VITE_API_URL` is a DEV-ONLY override (point `npm run dev` at a live API). It
 * is deliberately ignored on deployed hosts: a stale value in `.env` at build
 * time must never be able to make production talk to a different environment.
 */
const resolveApiUrl = (): string => {
  if (typeof window === 'undefined') return DEV_API_URL

  const host = window.location.hostname
  const isDevHost =
    host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')

  if (isDevHost) return import.meta.env.VITE_API_URL ?? DEV_API_URL

  return `${window.location.origin}/api`
}

export const API_URL = resolveApiUrl()

/** Error thrown for non-2xx API responses, carrying the backend payload. */
export class ApiError extends Error {
  status: number
  errorCode?: string
  /** Laravel validation errors keyed by field. */
  errors?: Record<string, string[]>
  /** Raw response body — for endpoints whose failures still carry detail. */
  payload?: unknown

  constructor(
    status: number,
    message: string,
    errorCode?: string,
    errors?: Record<string, string[]>,
    payload?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errorCode = errorCode
    this.errors = errors
    this.payload = payload
  }
}

/**
 * Human-readable message from any thrown error, flattening Laravel
 * validation errors (`ApiError.errors`) when present.
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.errors) {
      const messages = Object.values(err.errors).flat()
      if (messages.length > 0) return messages.join(' ')
    }
    return err.message || fallback
  }
  return err instanceof Error ? err.message : fallback
}

/** Everything an error carries, unflattened — for developer surfaces only. */
export interface ApiErrorDebug {
  /** 0 when the request never reached the server. */
  status: number
  errorCode?: string
  /** The raw backend message, before any friendlier fallback replaced it. */
  message: string
  /** What to check first, when the API had an opinion. */
  hint?: string
  /** The API's `debug` block (developer accounts), else the raw body. */
  detail?: unknown
}

/**
 * The full story behind a failure, for `developer` accounts only — the API
 * attaches its `debug` block to the same role, so a normal trader's response
 * simply has nothing here to read. Everyone else keeps
 * {@link getApiErrorMessage}'s single sentence.
 */
export function getApiErrorDebug(err: unknown): ApiErrorDebug {
  if (err instanceof ApiError) {
    const payload = err.payload as { debug?: Record<string, unknown> } | undefined
    const debug = payload?.debug
    return {
      status: err.status,
      errorCode: err.errorCode,
      message: err.message,
      hint: typeof debug?.hint === 'string' ? debug.hint : undefined,
      detail: debug ?? err.payload,
    }
  }
  return {
    status: 0,
    message: err instanceof Error ? err.message : String(err),
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  auth?: boolean
}

export async function apiFetch<T>(
  path: string,
  { method = 'GET', body, auth = false }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is the API running?')
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data.message ?? `Request failed (${res.status})`,
      data.error_code,
      data.errors,
      data,
    )
  }

  return data as T
}
