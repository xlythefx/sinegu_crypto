import { apiFetch } from './api'
import type { AdminWebhooksData } from '../types/adminWebhooks'

/**
 * GET /admin/webhooks — every engine webhook (exchange × feed) with its path,
 * the two base URLs, whether the engine has the venue on, and how many
 * accounts each reaches. Full admins only. Never carries a secret — only
 * whether one is set.
 */
export async function getAdminWebhooks(): Promise<AdminWebhooksData> {
  const { success: _ok, ...data } = await apiFetch<{ success: boolean } & AdminWebhooksData>(
    '/admin/webhooks',
    { auth: true },
  )
  return { ...data, webhooks: data.webhooks ?? [] }
}
