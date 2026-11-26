import { apiFetch } from './api'
import type { AiAccessData, AiAccessKey, AiCreatedKey, AiKeySwitch, AiLogPage } from '../types/aiAccess'

/**
 * Admin → AI Access: keys for the read-only AI connector (the employer's
 * Grok app posts to /api/mcp with one) and the log of what it asked. Full
 * admins only. The plain key exists in exactly one response — createAiKey's.
 */
export async function getAiAccess(): Promise<AiAccessData> {
  const { success: _ok, ...data } = await apiFetch<{ success: boolean } & AiAccessData>('/admin/ai-access', {
    auth: true,
  })
  return { ...data, keys: data.keys ?? [], tools: data.tools ?? [] }
}

/** `expiresInDays: null` = a key that never expires (valid until revoked). */
export async function createAiKey(name: string, expiresInDays: number | null): Promise<AiCreatedKey> {
  const { key, plain_key } = await apiFetch<{ success: boolean } & AiCreatedKey>('/admin/ai-access/keys', {
    method: 'POST',
    auth: true,
    body: expiresInDays === null ? { name, never_expires: true } : { name, expires_in_days: expiresInDays },
  })
  return { key, plain_key }
}

export async function revokeAiKey(id: number): Promise<AiAccessKey> {
  const { key } = await apiFetch<{ success: boolean; key: AiAccessKey }>(`/admin/ai-access/keys/${id}`, {
    method: 'DELETE',
    auth: true,
  })
  return key
}

/**
 * Switch one of a key's extra rights on (or off): `can_create` = make images /
 * clips and Idea plans in Creatives; `can_see_contacts` = read the Telegram
 * usernames people gave at sign-up.
 */
export async function setAiKeySwitch(id: number, which: AiKeySwitch, on: boolean): Promise<AiAccessKey> {
  const { key } = await apiFetch<{ success: boolean; key: AiAccessKey }>(`/admin/ai-access/keys/${id}`, {
    method: 'PUT',
    auth: true,
    body: { [which]: on },
  })
  return key
}

export async function getAiLog(params: { beforeId?: number; toolsOnly?: boolean } = {}): Promise<AiLogPage> {
  const q = new URLSearchParams({ limit: '50' })
  if (params.beforeId) q.set('before_id', String(params.beforeId))
  if (params.toolsOnly) q.set('tools_only', '1')
  const { success: _ok, ...page } = await apiFetch<{ success: boolean } & AiLogPage>(
    `/admin/ai-access/log?${q.toString()}`,
    { auth: true },
  )
  return { ...page, entries: page.entries ?? [] }
}
