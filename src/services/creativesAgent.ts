import { apiFetch } from './api'
import type {
  CreativeAgentJob,
  CreativeAgentJobResult,
  CreativeAgentMessage,
  CreativeAgentSessionState,
  CreativeAgentTurnInput,
  CreativeAgentTurnResult,
  CreativeBrief,
  CreativeMemory,
  CreativeMemoryInput,
} from '../types/creatives'

/**
 * Admin → Creatives: the chat agent (Claude), the brand brief it follows and
 * the team's memory notes. Same staff group as the rest of Creatives — the
 * one admin area a collaborator (the marketing team) may write.
 *
 * The agent loop is CLIENT-STEPPED: one request is at most one model call
 * (Cloudflare cuts a request at 100 s), so the caller keeps calling
 * `agentTurn` without text while the answer says `continue`.
 */

type Ok<T> = { success: boolean } & T

/** Laravel decimals can arrive as strings ("0.3700"); the screens want numbers. */
const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function normaliseJob(job: CreativeAgentJob): CreativeAgentJob {
  return {
    ...job,
    estimated_usd: num(job.estimated_usd),
    steps: (job.steps ?? []).map((s) => ({
      ...s,
      usd: num(s.usd),
      generation: s.generation ? { ...s.generation, outputs: s.generation.outputs ?? [] } : null,
      error: s.error ?? null,
    })),
  }
}

function normaliseSession(res: Ok<CreativeAgentSessionState>): CreativeAgentSessionState {
  return {
    session: res.session,
    messages: res.messages ?? [],
    jobs: (res.jobs ?? []).map(normaliseJob),
    budget: res.budget,
  }
}

/**
 * The caller's chat: the given id when it is theirs and under 7 days old,
 * else their newest, else a new one. Running jobs are moved on first.
 */
export async function getAgentSession(id?: string): Promise<CreativeAgentSessionState> {
  const qs = id ? `?id=${encodeURIComponent(id)}` : ''
  return normaliseSession(
    await apiFetch<Ok<CreativeAgentSessionState>>(`/admin/creatives/agent/session${qs}`, { auth: true }),
  )
}

/** "New chat": a fresh, empty session. The old transcript is not kept; memory, brief and plans are. */
export async function createAgentSession(): Promise<CreativeAgentSessionState> {
  return normaliseSession(
    await apiFetch<Ok<CreativeAgentSessionState>>('/admin/creatives/agent/sessions', { method: 'POST', auth: true }),
  )
}

/** One step of the agent: at most one model call, its tools run at once. */
export async function agentTurn(input: CreativeAgentTurnInput): Promise<CreativeAgentTurnResult> {
  const res = await apiFetch<Ok<CreativeAgentTurnResult>>('/admin/creatives/agent/turn', {
    method: 'POST',
    auth: true,
    body: input,
  })
  return {
    status: res.status,
    messages: (res.messages ?? []) as CreativeAgentMessage[],
    jobs: (res.jobs ?? []).map(normaliseJob),
    budget: res.budget,
    cost_usd: num(res.cost_usd),
  }
}

/** Go: starts the job's first step (each step reserves its own price, as always). */
export async function approveAgentJob(id: number): Promise<CreativeAgentJobResult> {
  const { job, budget } = await apiFetch<Ok<CreativeAgentJobResult>>(`/admin/creatives/agent/jobs/${id}/approve`, {
    method: 'POST',
    auth: true,
  })
  return { job: normaliseJob(job), budget }
}

/** A proposed job is dropped; a running one starts no further steps (and its queued step is cancelled when it can be). */
export async function cancelAgentJob(id: number): Promise<CreativeAgentJobResult> {
  const { job, budget } = await apiFetch<Ok<CreativeAgentJobResult>>(`/admin/creatives/agent/jobs/${id}/cancel`, {
    method: 'POST',
    auth: true,
  })
  return { job: normaliseJob(job), budget }
}

/* ---------- the brand brief ---------- */

export async function getCreativeBrief(): Promise<CreativeBrief> {
  const { brief } = await apiFetch<Ok<{ brief: CreativeBrief }>>('/admin/creatives/brief', { auth: true })
  return { ...brief, markdown: brief.markdown ?? '' }
}

/** ≤ 20,000 characters. */
export async function updateCreativeBrief(markdown: string): Promise<CreativeBrief> {
  const { brief } = await apiFetch<Ok<{ brief: CreativeBrief }>>('/admin/creatives/brief', {
    method: 'PUT',
    auth: true,
    body: { markdown },
  })
  return { ...brief, markdown: brief.markdown ?? '' }
}

/* ---------- memory ---------- */

/** Newest first. */
export async function getCreativeMemories(): Promise<CreativeMemory[]> {
  const { memories } = await apiFetch<Ok<{ memories: CreativeMemory[] }>>('/admin/creatives/memory', { auth: true })
  return memories ?? []
}

export async function createCreativeMemory(input: CreativeMemoryInput): Promise<CreativeMemory> {
  const { memory } = await apiFetch<Ok<{ memory: CreativeMemory }>>('/admin/creatives/memory', {
    method: 'POST',
    auth: true,
    body: input,
  })
  return memory
}

/** Partial: a key left out stays as it is. */
export async function updateCreativeMemory(id: number, patch: Partial<CreativeMemoryInput>): Promise<CreativeMemory> {
  const { memory } = await apiFetch<Ok<{ memory: CreativeMemory }>>(`/admin/creatives/memory/${id}`, {
    method: 'PUT',
    auth: true,
    body: patch,
  })
  return memory
}

export async function deleteCreativeMemory(id: number): Promise<void> {
  await apiFetch<Ok<object>>(`/admin/creatives/memory/${id}`, { method: 'DELETE', auth: true })
}
