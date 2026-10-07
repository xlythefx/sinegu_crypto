import { clearSession, getToken, updateStoredUser } from '../lib/session'
import { EMAIL_UNVERIFIED, VERIFY_EMAIL_PATH } from '../lib/emailVerification'

/** The API's answer to a suspended account's token (EnsureAccountActive). */
export const ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED'

/** Local Laravel dev server (`php artisan serve`). */
const DEV_API_URL = 'http://127.0.0.1:8000/api'

/** The live API — where `VITE_USE_PROD_API=1` sends `npm run dev`. */
const PROD_API_URL = 'https://pixel-alpha.com/api'

/** localhost / 127.0.0.1 / *.local — i.e. `npm run dev`, never a deployment. */
const isDevHost = (): boolean => {
  if (typeof window === 'undefined') return true
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')
}

/**
 * The dev/prod DATA switch: `VITE_USE_PROD_API=1` in `.env` makes the local dev
 * server read and WRITE the live database (real users, real invoices, real
 * exchange accounts) instead of the WAMP one. 0 or unset = local.
 *
 * It only ever applies on a dev host — a deployed build cannot be flipped by
 * an env var, in either direction. Vite restarts `npm run dev` when `.env`
 * changes, so flipping it takes effect on the next page load; a `npm run build`
 * bakes whatever the flag said at build time, which is why it is dev-only.
 */
export const USING_PROD_API =
  isDevHost() && import.meta.env.VITE_USE_PROD_API === '1'

/**
 * API base URL resolution — decided at RUNTIME from the host, never baked into
 * the build. One `npm run build` works on localhost, on the bare VPS IP, and on
 * any domain pointed at it later, so no manual switching per deployment.
 *
 *   localhost / 127.0.0.1 / *.local  -> http://127.0.0.1:8000/api (or VITE_API_URL)
 *                                       ...unless VITE_USE_PROD_API=1
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

  if (isDevHost()) {
    if (USING_PROD_API) return import.meta.env.VITE_PROD_API_URL ?? PROD_API_URL
    return import.meta.env.VITE_API_URL ?? DEV_API_URL
  }

  return `${window.location.origin}/api`
}

export const API_URL = resolveApiUrl()

if (USING_PROD_API) {
  // Loud on purpose: the browser looks identical either way, and every write
  // from here lands on live customer data.
  console.warn(
    `[Pixel Alpha] LIVE PRODUCTION API — ${API_URL}. Writes hit real data. ` +
      'Set VITE_USE_PROD_API=0 in .env to go back to local.',
  )
}

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

/**
 * Safety net for a stale session: the stored user says nothing (or says
 * verified) but the API refuses with `EMAIL_UNVERIFIED`. Record the server's
 * verdict so the route guards agree with it, then hard-navigate to the code
 * screen — services live outside the router, and a full load also drops every
 * in-flight request of the page that was refused. The error is still thrown
 * so the caller's own handling unwinds normally.
 */
function redirectToVerify(): void {
  if (typeof window === 'undefined') return
  updateStoredUser({ email_verified: false })
  if (window.location.pathname !== VERIFY_EMAIL_PATH) {
    window.location.assign(VERIFY_EMAIL_PATH)
  }
}

/**
 * The session is over: the token we sent was refused (401 — it expired, or
 * was revoked when the account was suspended) or the account is suspended
 * (403 ACCOUNT_SUSPENDED). Until 2026-10-07 neither could happen mid-session —
 * tokens never expired and only `login` looked at `status` — so no page
 * handled it, and a dead session just left every request failing. Same full
 * load as redirectToVerify, for the same reason; `?reason=` lets /auth say why.
 */
function endSession(reason: 'expired' | 'suspended'): void {
  if (typeof window === 'undefined') return
  clearSession()
  if (window.location.pathname !== '/auth') {
    window.location.assign(`/auth?reason=${reason}`)
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
  const token = auth ? getToken() : null
  if (token) headers.Authorization = `Bearer ${token}`

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
    // The API names its errors `error_code`; the email-verification endpoints
    // may answer with `code`. Accept either, and only a string.
    const errorCode: string | undefined =
      typeof data.error_code === 'string'
        ? data.error_code
        : typeof data.code === 'string'
          ? data.code
          : undefined

    if (res.status === 403 && errorCode === EMAIL_UNVERIFIED) {
      redirectToVerify()
    }

    // Only when a token was actually sent: a 401 from login itself is a wrong
    // password, not a dead session. Sign-out is excluded — an expired token
    // is exactly when someone reaches for Log out, and the layout already
    // clears the session and navigates to /auth without a "session expired".
    if (token && path !== '/auth/logout') {
      if (res.status === 401) endSession('expired')
      if (res.status === 403 && errorCode === ACCOUNT_SUSPENDED) endSession('suspended')
    }

    throw new ApiError(
      res.status,
      data.message ?? `Request failed (${res.status})`,
      errorCode,
      data.errors,
      data,
    )
  }

  return data as T
}
