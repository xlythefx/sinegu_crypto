import { apiFetch } from './api'
import type {
  CreativeAgentContextView,
  CreativeAgentJob,
  CreativeAgentJobResult,
  CreativeAgentMessage,
  CreativeAgentSessionState,
  CreativeAgentTurnInput,
  CreativeAgentTurnResult,
  CreativeBrief,
  CreativeMemory,
  CreativeMemoryInput,
  CreativePlaybook,
  CreativeStyle,
  CreativeStyleInput,
  CreativeTeamChat,
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

/** Prices as numbers and a step list that is always there (also used by the video editor's jobs). */
export function normaliseJob(job: CreativeAgentJob): CreativeAgentJob {
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

/** A storyboard's prices and lengths as numbers (decimals can arrive as strings). */
function normaliseMessage(m: CreativeAgentMessage): CreativeAgentMessage {
  if (m.kind !== 'storyboard' || !m.storyboard) return m
  const b = m.storyboard
  return {
    ...m,
    storyboard: {
      ...b,
      video_id: b.video_id ? Number(b.video_id) : null,
      style: b.style ?? '',
      notes: b.notes ?? '',
      total_seconds: num(b.total_seconds),
      est_total_usd: num(b.est_total_usd),
      scenes: (b.scenes ?? []).map((s, i) => ({
        ...s,
        n: num(s.n) || i + 1,
        seconds: num(s.seconds),
        generated_seconds: num(s.generated_seconds) || num(s.seconds),
        est_usd: num(s.est_usd),
        shows: s.shows ?? '',
        why: s.why ?? '',
        engine_label: s.engine_label ?? '',
      })),
    },
  }
}

function normaliseSession(res: Ok<CreativeAgentSessionState>): CreativeAgentSessionState {
  return {
    session: res.session,
    messages: (res.messages ?? []).map(normaliseMessage),
    jobs: (res.jobs ?? []).map(normaliseJob),
    budget: res.budget,
    notice: res.notice ?? null,
    answering: res.answering ?? null,
  }
}

export interface AgentSessionQuery {
  /** The chat on screen, when there is one. */
  id?: string
  /** A video's editor chat (Creatives v2.1): that video's newest session for the caller, else a new one bound to it. */
  videoId?: number
}

/**
 * A chat (shared by the team): the given id when it is under 7 days old,
 * whoever started it, else the caller's newest, else a new one. With
 * `videoId` it is that video's ONE editor chat for everyone instead (404 when
 * the video does not exist); without it the main workspace chat, which never
 * picks a video's session. Running jobs are moved on first.
 */
export async function getAgentSession({ id, videoId }: AgentSessionQuery = {}): Promise<CreativeAgentSessionState> {
  const params = new URLSearchParams()
  if (id) params.set('id', id)
  if (videoId) params.set('video_id', String(videoId))
  const qs = params.toString()
  return normaliseSession(
    await apiFetch<Ok<CreativeAgentSessionState>>(`/admin/creatives/agent/session${qs ? `?${qs}` : ''}`, { auth: true }),
  )
}

/**
 * "New chat": a fresh, empty session (bound to the video when given). The
 * old transcript is not kept; memory, brief and plans are.
 */
/** The team's live chats, newest first (chats are shared); with `videoId`, that video's editor chats. */
export async function getTeamChats({ videoId }: { videoId?: number } = {}): Promise<CreativeTeamChat[]> {
  const { sessions } = await apiFetch<Ok<{ sessions: CreativeTeamChat[] }>>(
    `/admin/creatives/agent/sessions${videoId ? `?video_id=${videoId}` : ''}`,
    { auth: true },
  )
  return sessions
}

export async function createAgentSession({ videoId }: { videoId?: number } = {}): Promise<CreativeAgentSessionState> {
  return normaliseSession(
    await apiFetch<Ok<CreativeAgentSessionState>>('/admin/creatives/agent/sessions', {
      method: 'POST',
      auth: true,
      ...(videoId ? { body: { video_id: videoId } } : {}),
    }),
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
    messages: ((res.messages ?? []) as CreativeAgentMessage[]).map(normaliseMessage),
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

/* ---------- the video playbook ---------- */

export async function getCreativePlaybook(): Promise<CreativePlaybook> {
  const { playbook } = await apiFetch<Ok<{ playbook: CreativePlaybook }>>('/admin/creatives/playbook', { auth: true })
  return { ...playbook, markdown: playbook.markdown ?? '' }
}

/** ≤ 20,000 characters. */
export async function updateCreativePlaybook(markdown: string): Promise<CreativePlaybook> {
  const { playbook } = await apiFetch<Ok<{ playbook: CreativePlaybook }>>('/admin/creatives/playbook', {
    method: 'PUT',
    auth: true,
    body: { markdown },
  })
  return { ...playbook, markdown: playbook.markdown ?? '' }
}

/* ---------- marketing styles ---------- */

const normaliseStyle = (s: CreativeStyle): CreativeStyle => ({
  ...s,
  markdown: s.markdown ?? '',
  summary: s.summary ?? '',
  sort: Number(s.sort) || 0,
})

/** Every style, disabled ones included, in the API's order (sort, then name). */
export async function getCreativeStyles(): Promise<CreativeStyle[]> {
  const { styles } = await apiFetch<Ok<{ styles: CreativeStyle[] }>>('/admin/creatives/styles', { auth: true })
  return (styles ?? []).map(normaliseStyle)
}

export async function createCreativeStyle(input: CreativeStyleInput): Promise<CreativeStyle> {
  const { style } = await apiFetch<Ok<{ style: CreativeStyle }>>('/admin/creatives/styles', {
    method: 'POST',
    auth: true,
    body: input,
  })
  return normaliseStyle(style)
}

/** Partial: a key left out stays as it is. */
export async function updateCreativeStyle(id: number, patch: Partial<CreativeStyleInput>): Promise<CreativeStyle> {
  const { style } = await apiFetch<Ok<{ style: CreativeStyle }>>(`/admin/creatives/styles/${id}`, {
    method: 'PUT',
    auth: true,
    body: patch,
  })
  return normaliseStyle(style)
}

/** 409 STYLE_IN_USE while a video project uses it. */
export async function deleteCreativeStyle(id: number): Promise<void> {
  await apiFetch<Ok<object>>(`/admin/creatives/styles/${id}`, { method: 'DELETE', auth: true })
}

/* ---------- the Context view ---------- */

/** What the agent reads before the next message, read-only (nothing is marked as sent). */
export async function getAgentContext(sessionId?: string): Promise<CreativeAgentContextView> {
  const qs = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ''
  const { context } = await apiFetch<Ok<{ context: CreativeAgentContextView }>>(
    `/admin/creatives/agent/context${qs}`,
    { auth: true },
  )
  return {
    system: context.system ?? '',
    tools: context.tools ?? [],
    playbook: context.playbook ?? { version: null, markdown: '' },
    brief: context.brief ?? { version: null, markdown: '' },
    memory: context.memory ?? { version: null, text: '' },
    styles: context.styles ?? [],
    context_block: context.context_block ?? '',
  }
}
