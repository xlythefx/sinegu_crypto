import { apiFetch } from './api'
import type {
  CreativeBudget,
  CreativeCharacter,
  CreativeCharacterInput,
  CreativeEstimate,
  CreativeGeneration,
  CreativeGenerationInput,
  CreativeGenerationPage,
  CreativePlan,
  CreativePlanInput,
  CreativesMeta,
} from '../types/creatives'

/**
 * Admin → Creatives: content plans, the one character, Higgsfield generations
 * and the monthly budget. The ONE admin area a collaborator (the marketing
 * team) may write; the cap itself is full admins only (`PUT …/budget`).
 */

type Ok<T> = { success: boolean } & T

export async function getCreativesMeta(): Promise<CreativesMeta> {
  const { success: _ok, ...meta } = await apiFetch<Ok<CreativesMeta>>('/admin/creatives', { auth: true })
  return { ...meta, models: meta.models ?? [] }
}

export async function getCreativeBudget(): Promise<CreativeBudget> {
  const { budget } = await apiFetch<Ok<{ budget: CreativeBudget }>>('/admin/creatives/budget', { auth: true })
  return budget
}

/** Full admins only. 0 switches generation off for everyone. */
export async function updateCreativeBudget(monthlyCapUsd: number): Promise<CreativeBudget> {
  const { budget } = await apiFetch<Ok<{ budget: CreativeBudget }>>('/admin/creatives/budget', {
    method: 'PUT',
    auth: true,
    body: { monthly_cap_usd: monthlyCapUsd },
  })
  return budget
}

/* ---------- plans ---------- */

export async function getCreativePlans(): Promise<CreativePlan[]> {
  const { plans } = await apiFetch<Ok<{ plans: CreativePlan[] }>>('/admin/creatives/plans', { auth: true })
  return plans ?? []
}

export async function createCreativePlan(input: CreativePlanInput): Promise<CreativePlan> {
  const { plan } = await apiFetch<Ok<{ plan: CreativePlan }>>('/admin/creatives/plans', {
    method: 'POST',
    auth: true,
    body: input,
  })
  return plan
}

/** Partial: a key left out stays as it is. */
export async function updateCreativePlan(id: number, patch: Partial<CreativePlanInput>): Promise<CreativePlan> {
  const { plan } = await apiFetch<Ok<{ plan: CreativePlan }>>(`/admin/creatives/plans/${id}`, {
    method: 'PUT',
    auth: true,
    body: patch,
  })
  return plan
}

/** Its generations keep their records; they are only unlinked from the plan. */
export async function deleteCreativePlan(id: number): Promise<void> {
  await apiFetch<Ok<object>>(`/admin/creatives/plans/${id}`, { method: 'DELETE', auth: true })
}

/* ---------- the character ---------- */

export async function getCreativeCharacter(): Promise<CreativeCharacter> {
  const { character } = await apiFetch<Ok<{ character: CreativeCharacter }>>('/admin/creatives/character', {
    auth: true,
  })
  return { ...character, refs: character.refs ?? [] }
}

export async function updateCreativeCharacter(input: CreativeCharacterInput): Promise<CreativeCharacter> {
  const { character } = await apiFetch<Ok<{ character: CreativeCharacter }>>('/admin/creatives/character', {
    method: 'PUT',
    auth: true,
    body: input,
  })
  return { ...character, refs: character.refs ?? [] }
}

/** png / jpg / webp, at most 5 MB (checked again on the server). */
export async function uploadCharacterRef(file: File, label?: string): Promise<CreativeCharacter> {
  const form = new FormData()
  form.append('image', file)
  if (label && label.trim()) form.append('label', label.trim())
  const { character } = await apiFetch<Ok<{ character: CreativeCharacter }>>('/admin/creatives/character/refs', {
    method: 'POST',
    auth: true,
    body: form,
  })
  return { ...character, refs: character.refs ?? [] }
}

/** Keep one output of a completed image generation as a stored reference image. */
export async function addCharacterRefFromGeneration(
  generationId: number,
  index: number,
  label?: string,
): Promise<CreativeCharacter> {
  const { character } = await apiFetch<Ok<{ character: CreativeCharacter }>>(
    '/admin/creatives/character/refs/from-generation',
    {
      method: 'POST',
      auth: true,
      body: { generation_id: generationId, index, ...(label ? { label } : {}) },
    },
  )
  return { ...character, refs: character.refs ?? [] }
}

export async function deleteCharacterRef(id: number): Promise<CreativeCharacter> {
  const { character } = await apiFetch<Ok<{ character: CreativeCharacter }>>(
    `/admin/creatives/character/refs/${id}`,
    { method: 'DELETE', auth: true },
  )
  return { ...character, refs: character.refs ?? [] }
}

/* ---------- generations ---------- */

export async function getCreativeGenerations(
  params: { beforeId?: number; limit?: number; planId?: number } = {},
): Promise<CreativeGenerationPage> {
  const q = new URLSearchParams()
  if (params.beforeId) q.set('before_id', String(params.beforeId))
  if (params.limit) q.set('limit', String(params.limit))
  if (params.planId) q.set('plan_id', String(params.planId))
  const qs = q.toString()
  const { generations, has_more } = await apiFetch<Ok<CreativeGenerationPage>>(
    `/admin/creatives/generations${qs ? `?${qs}` : ''}`,
    { auth: true },
  )
  return { generations: generations ?? [], has_more: Boolean(has_more) }
}

/**
 * One generation, freshly read — the list asked for exactly the row below
 * `id + 1`. Its signed download path is new, so it works even when the one
 * on screen (valid 30 min) has run out. Null when it no longer exists.
 */
export async function getCreativeGeneration(id: number): Promise<CreativeGeneration | null> {
  const page = await getCreativeGenerations({ beforeId: id + 1, limit: 1 })
  const row = page.generations[0]
  return row && row.id === id ? row : null
}

/** The price of a request, from Higgsfield, without generating anything (free). */
export async function estimateGeneration(input: CreativeGenerationInput): Promise<CreativeEstimate> {
  const { usd, budget, allowed } = await apiFetch<Ok<CreativeEstimate>>('/admin/creatives/generations/estimate', {
    method: 'POST',
    auth: true,
    body: input,
  })
  return { usd, budget, allowed }
}

/** Costs real money: the estimate is reserved against the month's cap at once. */
export async function createGeneration(
  input: CreativeGenerationInput,
): Promise<{ generation: CreativeGeneration; budget: CreativeBudget }> {
  const { generation, budget } = await apiFetch<Ok<{ generation: CreativeGeneration; budget: CreativeBudget }>>(
    '/admin/creatives/generations',
    { method: 'POST', auth: true, body: input },
  )
  return { generation, budget }
}

/** Only while queued; refunded (409 NOT_CANCELLABLE once it has started). */
export async function cancelGeneration(
  id: number,
): Promise<{ generation: CreativeGeneration; budget: CreativeBudget }> {
  const { generation, budget } = await apiFetch<Ok<{ generation: CreativeGeneration; budget: CreativeBudget }>>(
    `/admin/creatives/generations/${id}/cancel`,
    { method: 'POST', auth: true },
  )
  return { generation, budget }
}
