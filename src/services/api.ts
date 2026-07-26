import { getToken } from '../lib/session'

export const API_URL =
  import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api'

/** Error thrown for non-2xx API responses, carrying the backend payload. */
export class ApiError extends Error {
  status: number
  errorCode?: string
  /** Laravel validation errors keyed by field. */
  errors?: Record<string, string[]>

  constructor(
    status: number,
    message: string,
    errorCode?: string,
    errors?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errorCode = errorCode
    this.errors = errors
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
    )
  }

  return data as T
}
