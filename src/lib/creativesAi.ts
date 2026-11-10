/**
 * Pure helpers for the Creatives AI writer (Claude): limits, the error
 * sentences, which fields a draft would overwrite, and the week's public
 * figures as plain lines. No React.
 */

import { ApiError } from '../services/api'
import { creativeErrorMessage, errorBudget, fmtBudget } from './creatives'
import { fmtShortDate, fmtSignedPct } from './format'
import type { CreativeAiFacts, CreativeAiIdea, CreativeBudget, CreativeFormat } from '../types/creatives'

/** The brief the API accepts (3–500 characters). */
export const AI_BRIEF_MIN = 3
export const AI_BRIEF_MAX = 500

/** "Suggest ideas": the optional focus (≤ 300) and how many (3–8, default 5). */
export const AI_FOCUS_MAX = 300
export const AI_IDEA_COUNTS = ['3', '4', '5', '6', '7', '8'] as const
export const AI_IDEA_COUNT_DEFAULT = '5'

/** A plan's video prompt (≤ 4000) — longer than the Studio's own prompt box takes. */
export const VIDEO_PROMPT_MAX = 4000
export const STUDIO_PROMPT_MAX = 2000

/**
 * Mirrors `CreativeAi::MAX_CALL_USD`: the API refuses an AI call when less
 * than this is left in the month, as head-room for one call's worst case.
 * Only used to warn early — the server decides.
 */
export const AI_MAX_CALL_USD = 0.5

/**
 * A heads-up before pressing an AI button when the page's budget says the
 * server would refuse it — or null. Only a warning: the figure on screen can
 * be minutes old, so the button still asks and the server decides.
 */
export function aiBudgetWarning(budget: CreativeBudget): string | null {
  if (budget.cap_usd <= 0) {
    return 'This month’s cap is $0, so the AI writer is switched off too. A full admin can raise it in Budget.'
  }
  if (budget.remaining_usd < AI_MAX_CALL_USD) {
    return `Less than ${fmtBudget(AI_MAX_CALL_USD)} is left in this month’s budget, so Claude may not be able to answer. A full admin can raise the cap in Budget.`
  }
  return null
}

/** The price line every AI button carries, so nobody spends without knowing. */
export const AI_COST_HINT = 'A few cents a time (typically $0.03–0.10), from this month’s budget.'

/** The one sentence for a server without an Anthropic key. */
export const AI_NOT_CONNECTED = 'Claude isn’t connected on this server'

/* ---------- the fields a draft fills ---------- */

export type DraftField = 'title' | 'hook' | 'script' | 'caption' | 'hashtags' | 'video_prompt'

export const DRAFT_FIELDS: readonly DraftField[] = ['title', 'hook', 'script', 'caption', 'hashtags', 'video_prompt']

const FIELD_LABEL: Record<DraftField, string> = {
  title: 'title',
  hook: 'hook',
  script: 'script',
  caption: 'caption',
  hashtags: 'hashtags',
  video_prompt: 'video prompt',
}

/** "the hook", "the hook and script", "the title, hook and caption". */
export function joinFields(fields: readonly DraftField[]): string {
  const names = fields.map((f) => FIELD_LABEL[f])
  if (names.length === 0) return ''
  if (names.length === 1) return `the ${names[0]}`
  return `the ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * The fields a draft would overwrite that hold text someone wrote. The title
 * does not count when it IS the idea (the brief was taken from it) or was put
 * there from a suggested idea — replacing it with a finished title is the point.
 */
export function fieldsToReplace(
  values: Record<DraftField, string>,
  brief: string,
  seededTitle?: string | null,
): DraftField[] {
  return DRAFT_FIELDS.filter((f) => {
    const v = values[f].trim()
    if (v === '') return false
    if (f === 'title' && (v === brief.trim() || (seededTitle && v === seededTitle.trim()))) return false
    return true
  })
}

/** "Write it" on a suggested idea: its title and hook as the brief, within the limit. */
export function briefFromIdea(idea: CreativeAiIdea): string {
  const brief = idea.hook.trim() ? `${idea.title.trim()} — ${idea.hook.trim()}` : idea.title.trim()
  return brief.length > AI_BRIEF_MAX ? `${brief.slice(0, AI_BRIEF_MAX - 1).trimEnd()}…` : brief
}

/** What the Studio button on a plan says: the video for a video, the picture otherwise. */
export function makeLabel(format: CreativeFormat): string {
  if (format === 'image') return 'Make the image'
  if (format === 'carousel') return 'Make the images'
  return 'Make the video'
}

/* ---------- the week's figures ---------- */

/**
 * The public figures a draft was allowed to quote, one plain line each — so
 * whoever checks the draft can compare its numbers without opening anything.
 */
export function factsLines(f: CreativeAiFacts): string[] {
  if (!f.available) return []
  const lines: string[] = []
  if (f.return_pct !== null) lines.push(`${fmtSignedPct(f.return_pct, 2)} over the period`)
  lines.push(f.trades === 1 ? '1 trade' : `${f.trades.toLocaleString()} trades`)
  if (f.trading_days > 0) lines.push(`${f.green_days} of ${f.trading_days} trading days green`)
  if (f.best_day) lines.push(`Best day ${fmtShortDate(f.best_day.date)}: ${fmtSignedPct(f.best_day.pct, 2)}`)
  const coins = f.top_coins ?? []
  if (coins.length > 0) {
    lines.push(`Top coins: ${coins.map((c) => `${c.symbol} ${fmtSignedPct(c.share_pct, 2)}`).join(', ')}`)
  }
  return lines
}

/* ---------- errors ---------- */

/** Every AI-writer error as a plain sentence; anything else falls through to the page's own. */
export function creativeAiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    switch (err.errorCode) {
      case 'AI_NOT_CONFIGURED':
        return `${AI_NOT_CONNECTED}, so the AI writer is off here. You can still write the plan yourself.`
      case 'BUDGET_EXCEEDED': {
        const b = errorBudget(err)
        if (b && b.cap_usd <= 0) {
          return 'AI writing is switched off: this month’s cap is $0. A full admin can raise it in Budget.'
        }
        return b
          ? `There isn’t enough left in this month’s budget for the AI writer: ${fmtBudget(b.remaining_usd)} of ${fmtBudget(b.cap_usd)} is left, and it needs ${fmtBudget(AI_MAX_CALL_USD)} spare to be safe. Ask a full admin to raise the cap.`
          : 'There isn’t enough left in this month’s budget for the AI writer. Ask a full admin to raise the cap.'
      }
      case 'AI_REFUSED':
        return 'Claude declined to write this one. Try describing the idea another way. What it used still counts toward this month’s budget (a few cents).'
      case 'AI_UNAVAILABLE':
        return 'Claude didn’t answer just now — it may be busy. Nothing was written and nothing was charged. Try again in a minute.'
      case 'AI_BAD_OUTPUT':
        return 'Claude’s answer came back incomplete, so nothing was filled in. Try again. The attempt still counts toward this month’s budget (a few cents).'
    }
    // A gateway gave up waiting (nginx 504, Cloudflare 524): the API may still have finished.
    if (err.status === 504 || err.status === 524) {
      return 'Claude took too long to answer, so nothing was filled in. Try again — a shorter idea is quicker. The attempt may still count toward this month’s budget.'
    }
  }
  return creativeErrorMessage(err, fallback)
}
