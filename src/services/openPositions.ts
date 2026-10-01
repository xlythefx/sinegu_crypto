import { apiFetch } from './api'
import type {
  AdminOpenPositionsData,
  ClosePositionsRequest,
  ClosePositionsResponse,
  OpenPositionsRefreshState,
} from '../types/openPositions'

/** Every open position on every venue, each with a "can the engine close it" verdict. */
export async function getAdminOpenPositions(): Promise<AdminOpenPositionsData> {
  const { success: _ok, ...data } = await apiFetch<{ success: boolean } & AdminOpenPositionsData>(
    '/admin/open-positions',
    { auth: true },
  )
  return data
}

/**
 * Ask the engine to read every account's positions from the exchanges now.
 * Throws an ApiError 429 (`REFRESH_COOLDOWN`, payload carries `refresh`)
 * inside the 30 s platform-wide cooldown.
 */
export async function forceFetchOpenPositions(): Promise<{
  message: string
  refresh: OpenPositionsRefreshState
}> {
  const res = await apiFetch<{
    success: boolean
    message: string
    refresh: OpenPositionsRefreshState
  }>('/admin/open-positions/refresh', { method: 'POST', auth: true })
  return { message: res.message, refresh: res.refresh }
}

/** Close the named rows at market through the engine's exit path. */
export async function closeOpenPositions(
  body: ClosePositionsRequest,
): Promise<ClosePositionsResponse> {
  return apiFetch<ClosePositionsResponse>('/admin/open-positions/close', {
    method: 'POST',
    body,
    auth: true,
  })
}
