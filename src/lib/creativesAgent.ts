/**
 * Pure helpers for the Creatives chat agent: the panels and the old tab
 * links, the starter prompts, job and step labels, memory categories, the
 * error sentences and the merge rules for what the API sends. No React.
 */

import { ApiError } from '../services/api'
import { creativeErrorMessage, errorBudget, fmtBudget, fmtCost, type CreativeTone } from './creatives'
import { AI_MAX_CALL_USD, AI_NOT_CONNECTED } from './creativesAi'
import { parseUtc } from './format'
import type {
  CreativeAgentJob,
  CreativeAgentJobStatus,
  CreativeAgentMessage,
  CreativeAgentMode,
  CreativeAgentStepStatus,
  CreativeMemoryCategory,
} from '../types/creatives'

/* ---------- limits (the API checks them again) ---------- */

/** One message to the agent: 1–4000 characters. */
export const AGENT_TEXT_MAX = 4000
/** The brief: up to 20,000 characters of Markdown. */
export const BRIEF_MAX = 20_000
/** One memory note: up to 500 characters. */
export const MEMORY_TEXT_MAX = 500
/**
 * The server stops an answer after 8 model calls; this is the client's own
 * backstop, so a server that never says "done" cannot loop for ever.
 */
export const CLIENT_MAX_STEPS = 12

/* ---------- panels ---------- */

export type CreativesPanelKey = 'plans' | 'gallery' | 'pixel' | 'brief' | 'memory' | 'budget'

export interface PanelMeta {
  key: CreativesPanelKey
  /** The toggle's tooltip and the panel's heading. */
  label: string
  /** One line for the toggle's tooltip. */
  hint: string
}

/** Toggle order, left to right. */
export const PANELS: readonly PanelMeta[] = [
  { key: 'plans', label: 'Plans', hint: 'The content plan — every X and TikTok post' },
  { key: 'gallery', label: 'Gallery', hint: 'Everything made with Higgsfield, and “Make it yourself”' },
  { key: 'pixel', label: 'Pixel', hint: 'The character in every image and video' },
  { key: 'brief', label: 'Brief', hint: 'The brand brief the agent always follows' },
  { key: 'memory', label: 'Memory', hint: 'Notes the agent remembers in every chat' },
  { key: 'budget', label: 'Budget', hint: 'This month’s spend against the cap' },
]

export const PANEL_KEYS = PANELS.map((p) => p.key)

export function isPanelKey(v: string | null | undefined): v is CreativesPanelKey {
  return !!v && (PANEL_KEYS as readonly string[]).includes(v)
}

export function panelMeta(key: CreativesPanelKey): PanelMeta {
  return PANELS.find((p) => p.key === key) ?? PANELS[0]
}

/** The page used to have tabs; a bookmarked `?tab=` opens the matching panel. */
const TAB_TO_PANEL: Record<string, CreativesPanelKey> = {
  planner: 'plans',
  studio: 'gallery',
  character: 'pixel',
  budget: 'budget',
}

export function panelFromTab(tab: string | null | undefined): CreativesPanelKey | null {
  return tab ? (TAB_TO_PANEL[tab] ?? null) : null
}

/* ---------- modes + starters ---------- */

export const MODE_HINT: Record<CreativeAgentMode, string> = {
  ask: 'Talks it through — reads everything and never spends money',
  generate: 'Can spend money — every job asks for Go first',
}

export interface AgentStarter {
  text: string
  /** Generate starters switch the mode first, where everyone can see it. */
  mode: CreativeAgentMode
}

export const AGENT_STARTERS: readonly AgentStarter[] = [
  { text: 'Make this week’s recap video', mode: 'generate' },
  { text: 'What should we post this week?', mode: 'ask' },
  { text: 'Write 3 hooks for Meet Pixel', mode: 'ask' },
  { text: 'Show me what’s in the planner', mode: 'ask' },
]

/* ---------- jobs ---------- */

/** "$0.67" — a job's prices to the cent, so the total reads at a glance; under a cent the digits stay ("$0.004"). */
export function fmtJobUsd(usd: number): string {
  return usd > 0 && usd < 0.01 ? fmtCost(usd) : fmtBudget(usd)
}

export const JOB_STATUS: Record<CreativeAgentJobStatus, { label: string; tone: CreativeTone }> = {
  proposed: { label: 'Waiting for your Go', tone: 'accent' },
  running: { label: 'Running', tone: 'accent' },
  completed: { label: 'Done', tone: 'green' },
  failed: { label: 'Failed', tone: 'red' },
  canceled: { label: 'Cancelled', tone: 'muted' },
  expired: { label: 'Expired', tone: 'muted' },
}

export const STEP_STATUS: Record<CreativeAgentStepStatus, { label: string; tone: CreativeTone }> = {
  waiting: { label: 'Waiting', tone: 'muted' },
  running: { label: 'Making it', tone: 'accent' },
  completed: { label: 'Ready', tone: 'green' },
  failed: { label: 'Failed', tone: 'red' },
  canceled: { label: 'Cancelled', tone: 'muted' },
}

/** Milliseconds left to press Go; null when the job has no deadline. */
export function jobMsLeft(job: CreativeAgentJob, now: number): number | null {
  if (job.status !== 'proposed' || !job.expires_at) return null
  const at = parseUtc(job.expires_at)
  return at ? at.getTime() - now : null
}

/**
 * What the card should treat the job as: a proposed job past its hour is
 * expired here already (the server flips it on its next read).
 */
export function effectiveJobStatus(job: CreativeAgentJob, now: number): CreativeAgentJobStatus {
  const left = jobMsLeft(job, now)
  return left !== null && left <= 0 ? 'expired' : job.status
}

export function hasRunningJob(jobs: Iterable<CreativeAgentJob>): boolean {
  for (const j of jobs) if (j.status === 'running') return true
  return false
}

/** "1 step" / "3 steps". */
export function stepCount(n: number): string {
  return n === 1 ? '1 step' : `${n} steps`
}

/** A fingerprint of every step's generation — when it moves, the Gallery has something new. */
export function jobsFingerprint(jobs: Iterable<CreativeAgentJob>): string {
  const parts: string[] = []
  for (const j of jobs) {
    parts.push(`${j.id}:${j.status}:${j.steps.map((s) => `${s.generation?.id ?? '-'}/${s.generation?.status ?? '-'}`).join(',')}`)
  }
  return parts.sort().join('|')
}

/* ---------- memory ---------- */

export interface MemoryCategoryMeta {
  key: CreativeMemoryCategory
  label: string
  hint: string
}

export const MEMORY_CATEGORIES: readonly MemoryCategoryMeta[] = [
  { key: 'brand', label: 'Brand', hint: 'How Pixel Alpha looks and sounds' },
  { key: 'audience', label: 'Audience', hint: 'Who we talk to' },
  { key: 'performance', label: 'Performance', hint: 'What worked, what did not' },
  { key: 'process', label: 'Process', hint: 'How the team works' },
  { key: 'other', label: 'Other', hint: 'Anything else worth keeping' },
]

/** A category the server added later reads as "Other". */
export function memoryCategory(key: string): CreativeMemoryCategory {
  return MEMORY_CATEGORIES.some((c) => c.key === key) ? (key as CreativeMemoryCategory) : 'other'
}

/* ---------- what the API sends ---------- */

/** New messages joined to the ones on screen, by id, in id order (an id seen twice keeps the newer copy). */
export function mergeMessages(prev: CreativeAgentMessage[], next: CreativeAgentMessage[]): CreativeAgentMessage[] {
  if (next.length === 0) return prev
  const byId = new Map(prev.map((m) => [m.id, m]))
  for (const m of next) byId.set(m.id, m)
  return [...byId.values()].sort((a, b) => a.id - b.id)
}

/** Jobs keyed by id; a changed job replaces the one on screen. */
export function mergeJobs(
  prev: Record<number, CreativeAgentJob>,
  next: CreativeAgentJob[],
): Record<number, CreativeAgentJob> {
  if (next.length === 0) return prev
  const out = { ...prev }
  for (const j of next) out[j.id] = j
  return out
}

export function jobsById(jobs: CreativeAgentJob[]): Record<number, CreativeAgentJob> {
  return mergeJobs({}, jobs)
}

/** The last tool the agent ran in these messages ("Read the planner"), for the progress line. */
export function latestActivityLabel(messages: CreativeAgentMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const label = messages[i].kind === 'activity' ? messages[i].activity?.label?.trim() : ''
    if (label) return label
  }
  return null
}

/** Which panels an answer touched, so an open panel can re-read itself. */
export function touchedPanels(messages: CreativeAgentMessage[]): { plans: boolean; memory: boolean } {
  let plans = false
  let memory = false
  for (const m of messages) {
    if (m.kind === 'plan') plans = true
    const tool = m.kind === 'activity' ? (m.activity?.tool ?? '') : ''
    if (tool === 'create_plan' || tool === 'update_plan') plans = true
    if (tool === 'remember' || tool === 'forget' || tool === 'update_memory') memory = true
  }
  return { plans, memory }
}

export function lastMessageId(messages: CreativeAgentMessage[]): number {
  return messages.length > 0 ? messages[messages.length - 1].id : 0
}

/* ---------- errors ---------- */

/** Where the error happened — the same code reads differently on a message and on a job's Go. */
export type AgentErrorContext = { kind: 'turn' } | { kind: 'approve'; totalUsd: number } | { kind: 'cancel' }

/** Every agent error as a plain sentence for the marketing team. */
export function agentErrorMessage(err: unknown, context: AgentErrorContext, fallback: string): string {
  if (err instanceof ApiError) {
    switch (err.errorCode) {
      case 'AI_NOT_CONFIGURED':
        return `${AI_NOT_CONNECTED}, so the agent can’t answer here. The panels — plans, gallery, Pixel, brief, memory and budget — still work.`
      case 'BUDGET_EXCEEDED': {
        const b = errorBudget(err)
        if (b && b.cap_usd <= 0) {
          return 'Spending is switched off: this month’s cap is $0, so the agent can’t answer or make anything. A full admin can raise it in Budget.'
        }
        if (context.kind === 'approve') {
          return b
            ? `This job costs ${fmtJobUsd(context.totalUsd)}, but only ${fmtBudget(b.remaining_usd)} of this month’s ${fmtBudget(b.cap_usd)} is left, so it was not started and nothing was spent. Ask the agent for something cheaper, or ask a full admin to raise the cap.`
            : `This job costs ${fmtJobUsd(context.totalUsd)}, which is more than is left this month, so it was not started and nothing was spent.`
        }
        return b
          ? `There isn’t enough left in this month’s budget for the agent to answer: ${fmtBudget(b.remaining_usd)} of ${fmtBudget(b.cap_usd)} is left, and each reply needs ${fmtBudget(AI_MAX_CALL_USD)} spare to be safe. A full admin can raise the cap in Budget.`
          : 'There isn’t enough left in this month’s budget for the agent to answer. A full admin can raise the cap in Budget.'
      }
      case 'AI_REFUSED':
        return 'Claude declined to answer that one. Try putting it another way. What it used still counts toward this month’s budget (a few cents).'
      case 'AI_UNAVAILABLE':
        return 'Claude didn’t answer just now — it may be busy. Nothing was charged for this step. Try again in a minute.'
      case 'SESSION_BUSY':
        return 'The agent is still working on this chat — perhaps in another tab. Wait for it to finish, then try again.'
      case 'JOB_EXPIRED':
        return 'This job waited more than an hour for its Go, so it expired and nothing was spent. Ask the agent to propose it again.'
      case 'JOB_NOT_PROPOSED':
        return context.kind === 'cancel'
          ? 'This job has already finished or been stopped — perhaps in another tab. Its card shows where it is now.'
          : 'This job has already been started or cancelled — perhaps in another tab. Its card shows where it is now.'
      case 'NOT_FOUND':
        return context.kind === 'turn'
          ? 'This chat no longer exists (chats are kept for 7 days). Start a new chat.'
          : 'This job no longer exists. Start a new chat.'
    }
    if (err.status === 429) return 'Too many messages in one minute. Wait a moment and try again.'
    // A gateway gave up waiting (nginx 504, Cloudflare 524): the step may still have finished.
    if (err.status === 504 || err.status === 524) {
      return 'The agent took too long on one step, so it stopped there. Send a message to carry on.'
    }
  }
  return creativeErrorMessage(err, fallback)
}
