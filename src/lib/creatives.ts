/**
 * Pure helpers for Admin → Creatives — labels, colour tones, the expiry
 * countdown, signed-path URLs and the error sentences. No React.
 *
 * Tones are names, not classes: the components map them onto the design
 * tokens (components/admin/creatives/creativeClasses.ts), so both themes work.
 */

import { API_URL, ApiError, getApiErrorMessage } from '../services/api'
import { fmtMoney, parseUtc } from './format'
import type {
  CreativeBudget,
  CreativeFormat,
  CreativeGeneration,
  CreativeGenerationStatus,
  CreativeModelPreset,
  CreativeParamValue,
  CreativePlan,
  CreativePlanStatus,
  CreativePlatform,
} from '../types/creatives'

export type CreativeTone = 'muted' | 'teal' | 'accent' | 'silver' | 'green' | 'red'

/* ---------- plan stages ---------- */

export interface StageMeta {
  key: CreativePlanStatus
  label: string
  tone: CreativeTone
  /** One line for an empty column. */
  empty: string
}

/** Board order, left to right. */
export const PLAN_STAGES: readonly StageMeta[] = [
  { key: 'idea', label: 'Idea', tone: 'muted', empty: 'No ideas yet.' },
  { key: 'script', label: 'Script', tone: 'teal', empty: 'Nothing being written.' },
  { key: 'generating', label: 'Generating', tone: 'accent', empty: 'Nothing being made.' },
  { key: 'review', label: 'Review', tone: 'silver', empty: 'Nothing waiting for review.' },
  { key: 'approved', label: 'Approved', tone: 'green', empty: 'Nothing ready to post.' },
  { key: 'posted', label: 'Posted', tone: 'green', empty: 'Nothing posted yet.' },
]

export const STAGE_KEYS = PLAN_STAGES.map((s) => s.key)

export function stageMeta(key: CreativePlanStatus): StageMeta {
  return PLAN_STAGES.find((s) => s.key === key) ?? PLAN_STAGES[0]
}

/* ---------- platforms + formats ---------- */

export const PLATFORM_LABEL: Record<CreativePlatform, string> = { x: 'X', tiktok: 'TikTok' }
export const PLATFORM_KEYS: readonly CreativePlatform[] = ['x', 'tiktok']

export const FORMAT_LABEL: Record<CreativeFormat, string> = {
  video: 'Video',
  image: 'Image',
  carousel: 'Carousel',
}
export const FORMAT_KEYS: readonly CreativeFormat[] = ['video', 'image', 'carousel']

/** TikTok is a phone screen standing up; X shows a landscape frame best. */
export function defaultAspectRatio(platform: CreativePlatform): string {
  return platform === 'tiktok' ? '9:16' : '16:9'
}

/* ---------- generations ---------- */

export interface GenerationStatusMeta {
  label: string
  tone: CreativeTone
  /** Still with Higgsfield — the gallery keeps checking it. */
  pending: boolean
}

export const GENERATION_STATUS: Record<CreativeGenerationStatus, GenerationStatusMeta> = {
  submitting: { label: 'Sending', tone: 'accent', pending: true },
  queued: { label: 'Queued', tone: 'accent', pending: true },
  in_progress: { label: 'Generating', tone: 'accent', pending: true },
  completed: { label: 'Ready', tone: 'green', pending: false },
  failed: { label: 'Failed', tone: 'red', pending: false },
  nsfw: { label: 'Blocked', tone: 'red', pending: false },
  canceled: { label: 'Cancelled', tone: 'muted', pending: false },
  expired: { label: 'Deleted', tone: 'muted', pending: false },
}

export function isPendingGeneration(g: CreativeGeneration): boolean {
  return GENERATION_STATUS[g.status]?.pending ?? false
}

/** Past this age a still-pending row is stuck, not working — it stops the 5-second re-read. */
const PENDING_POLL_MAX_MS = 6 * 60 * 60 * 1000

/** Pending AND recent enough that re-reading the list can still move it. */
export function isPollingGeneration(g: CreativeGeneration, now: number): boolean {
  if (!isPendingGeneration(g)) return false
  const created = parseUtc(g.created_at)
  return !created || now - created.getTime() < PENDING_POLL_MAX_MS
}

/** Milliseconds until Higgsfield deletes the files; null when no date is known. */
export function msUntilExpiry(g: CreativeGeneration, now: number): number | null {
  if (!g.expires_at) return null
  const at = parseUtc(g.expires_at)
  return at ? at.getTime() - now : null
}

/**
 * Gone from Higgsfield: the server says so, or the expiry passed since the
 * list was read (the server flips the row on its next read).
 */
export function isExpiredGeneration(g: CreativeGeneration, now: number): boolean {
  if (g.status === 'expired') return true
  if (g.status !== 'completed') return false
  const left = msUntilExpiry(g, now)
  return left !== null && left <= 0
}

/** "6 d 4 h" / "5 h 12 min" / "8 min" — the time left before a deletion. */
export function fmtTimeLeft(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000))
  const d = Math.floor(minutes / 1440)
  const h = Math.floor((minutes % 1440) / 60)
  const m = minutes % 60
  if (d > 0) return h > 0 ? `${d} d ${h} h` : `${d} d`
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`
  return `${Math.max(1, m)} min`
}

/** Less than a day left: the countdown turns red so nobody loses a file. */
export const EXPIRY_WARN_MS = 24 * 60 * 60 * 1000

/**
 * A signed path the API handed out ("/api/creatives/…?signature=…") as a full
 * URL. Relative to the API's ORIGIN, which is right on prod and locally alike.
 */
export function signedUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return `${new URL(API_URL).origin}${path.startsWith('/') ? '' : '/'}${path}`
}

/**
 * Open a signed download in a new tab: an attachment downloads and the tab
 * closes, and an error never replaces the page the person is on.
 */
export function startSignedDownload(path: string): void {
  const a = document.createElement('a')
  a.href = signedUrl(path)
  a.target = '_blank'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** A signed download path is valid 30 min; one read longer ago than this is fetched again first. */
export const DOWNLOAD_FRESH_MS = 25 * 60 * 1000

/** "$0.004" / "$0.298" / "$12.50" — cents and below keep their digits. */
export function fmtCost(usd: number): string {
  if (usd === 0) return '$0.00'
  return fmtMoney(usd, Math.abs(usd) < 1 ? 3 : 2)
}

/** "$72.40" — budget figures. */
export function fmtBudget(usd: number): string {
  return fmtMoney(usd, 2)
}

/* ---------- plans ---------- */

/** The API's order: planned date ascending with undated last, then newest first. */
export function sortPlans(plans: CreativePlan[]): CreativePlan[] {
  return [...plans].sort((a, b) => {
    if (a.planned_for !== b.planned_for) {
      if (a.planned_for === null) return 1
      if (b.planned_for === null) return -1
      return a.planned_for < b.planned_for ? -1 : 1
    }
    return b.id - a.id
  })
}

/** Today in the reader's calendar, 'YYYY-MM-DD'. */
export function todayIso(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${m}-${d}`
}

/** Planned for a day already gone and still not posted. */
export function isPlanLate(plan: CreativePlan, today: string = todayIso()): boolean {
  return plan.status !== 'posted' && plan.planned_for !== null && plan.planned_for < today
}

/* ---------- studio drafts ---------- */

/**
 * A model's parameters at their defaults, with the aspect ratio set for the
 * plan's platform when the model has one and offers that shape.
 */
export function defaultParams(
  model: CreativeModelPreset,
  platform?: CreativePlatform | null,
): Record<string, CreativeParamValue> {
  const out: Record<string, CreativeParamValue> = {}
  for (const p of model.params) out[p.name] = p.default
  const ratio = model.params.find((p) => p.name === 'aspect_ratio')
  if (platform && ratio?.options?.map(String).includes(defaultAspectRatio(platform))) {
    out.aspect_ratio = defaultAspectRatio(platform)
  }
  return out
}

/**
 * What goes on the wire: empty text and unset values are left out (the
 * server applies its default), integers that are blank are left out too.
 */
export function cleanParams(
  model: CreativeModelPreset,
  values: Record<string, CreativeParamValue>,
): Record<string, CreativeParamValue> {
  const out: Record<string, CreativeParamValue> = {}
  for (const p of model.params) {
    const v = values[p.name]
    if (v === null || v === undefined) continue
    if (typeof v === 'string' && v.trim() === '') continue
    out[p.name] = typeof v === 'string' ? v.trim() : v
  }
  return out
}

const RATIO_HINT: Record<string, string> = {
  '9:16': 'tall · TikTok',
  '16:9': 'wide · X',
  '1:1': 'square',
  '4:5': 'portrait',
  '3:4': 'portrait',
  '4:3': 'landscape',
  '2:3': 'portrait',
  '3:2': 'landscape',
  '1:2': 'very tall',
  '2:1': 'very wide',
}

/** How a select option reads in the Studio form ("9:16 — tall · TikTok", "5 s", "4 images"). */
export function paramOptionLabel(name: string, option: string | number): string {
  const raw = String(option)
  if (name === 'aspect_ratio') {
    if (raw === 'auto') return 'Auto — the model decides'
    return RATIO_HINT[raw] ? `${raw} — ${RATIO_HINT[raw]}` : raw
  }
  if (name === 'duration') return `${raw} s`
  if (name === 'batch_size') return raw === '1' ? '1 image' : `${raw} images`
  if (name === 'quality' || name === 'resolution') return raw.charAt(0).toUpperCase() + raw.slice(1)
  return raw
}

/** A parameter the form cannot send as typed, as one sentence — or null. */
export function paramProblem(
  model: CreativeModelPreset,
  values: Record<string, CreativeParamValue>,
): string | null {
  for (const p of model.params) {
    if (p.type !== 'integer') continue
    const v = values[p.name]
    if (v === null || v === undefined || v === '') continue
    const n = Number(v)
    if (!Number.isInteger(n)) return `${p.label} must be a whole number.`
    if (p.min !== undefined && n < p.min) return `${p.label} must be at least ${p.min}.`
    if (p.max !== undefined && n > p.max) return `${p.label} must be at most ${p.max}.`
  }
  return null
}

/* ---------- errors ---------- */

function budgetFrom(err: ApiError): CreativeBudget | null {
  const payload = err.payload as { budget?: CreativeBudget } | undefined
  return payload?.budget ?? null
}

/** The budget an error carried (BUDGET_EXCEEDED sends it), so the page can update. */
export function errorBudget(err: unknown): CreativeBudget | null {
  return err instanceof ApiError ? budgetFrom(err) : null
}

/** Every Creatives error code, as a plain sentence for the marketing team. */
export function creativeErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return getApiErrorMessage(err, fallback)
  switch (err.errorCode) {
    case 'BUDGET_EXCEEDED': {
      const b = budgetFrom(err)
      if (b && b.cap_usd <= 0) {
        return 'Generating is switched off: this month’s cap is $0. A full admin can raise it in Budget.'
      }
      return b
        ? `This would go over this month’s budget: ${fmtBudget(b.remaining_usd)} of ${fmtBudget(b.cap_usd)} is left. Pick a cheaper setting, or ask a full admin to raise the cap.`
        : 'This would go over this month’s budget. Pick a cheaper setting, or ask a full admin to raise the cap.'
    }
    case 'NO_REFERENCES':
      return 'This model needs pictures of the character. Add at least one reference image in the Pixel panel first.'
    case 'NOT_CONFIGURED':
      return 'Higgsfield isn’t connected on this server, so nothing can be generated here. Planning still works.'
    case 'HIGGSFIELD_REJECTED':
      return `Higgsfield refused this request${err.message ? `: “${err.message.replace(/[.\s]+$/, '')}”.` : '.'} Nothing was charged.`
    case 'SUBMIT_UNCONFIRMED':
      return 'Higgsfield did not confirm this request, so it may still have been made and charged. Check Higgsfield’s usage page before trying again. Its cost stays counted in this month’s budget to be safe.'
    case 'ESTIMATE_UNAVAILABLE':
      return 'Higgsfield could not price this request right now, so nothing was generated. Try again in a minute.'
    case 'SOURCE_UNAVAILABLE':
      return 'The picture to animate is no longer available (Higgsfield may have deleted it). Pick another one.'
    case 'TOO_MANY_REFERENCES':
      return 'The character already has the most reference images allowed. Delete one in the Pixel panel first.'
    case 'NOT_CANCELLABLE':
      return 'Higgsfield has already started on it, so it can no longer be cancelled.'
    case 'NOT_FOUND':
      return 'That item no longer exists. Reload the page.'
    case 'EXPIRED':
      return 'Higgsfield has deleted this file — results are only kept for 7 days.'
  }
  if (err.status === 429) return 'Too many requests in one minute. Wait a moment and try again.'
  return getApiErrorMessage(err, fallback)
}
