import { apiFetch } from './api'
import type { AdminDevBotData, DevBotSettings, DevBotSettingsPatch } from '../types/adminDevBot'

/**
 * Admin → Error Bot — the developer error bot (@errorpixel_bot) from the admin
 * side. Full admins only. Nothing here returns a secret.
 */
export async function getAdminDevBot(): Promise<AdminDevBotData> {
  const { success: _ok, ...data } = await apiFetch<{ success: boolean } & AdminDevBotData>('/admin/devbot', { auth: true })
  return data
}

export async function updateDevBotSettings(patch: DevBotSettingsPatch): Promise<DevBotSettings> {
  const r = await apiFetch<{ settings: DevBotSettings }>('/admin/devbot/settings', { method: 'PUT', body: patch, auth: true })
  return r.settings
}

export async function sendDevBotTest(): Promise<void> {
  await apiFetch('/admin/devbot/test', { method: 'POST', auth: true })
}

export async function cancelDevBotJob(id: number): Promise<void> {
  await apiFetch(`/admin/devbot/jobs/${id}/cancel`, { method: 'POST', auth: true })
}

export async function retryDevBotJob(id: number): Promise<number> {
  const r = await apiFetch<{ job_id: number }>(`/admin/devbot/jobs/${id}/retry`, { method: 'POST', auth: true })
  return r.job_id
}
