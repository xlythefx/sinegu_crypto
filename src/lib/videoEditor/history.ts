import type { CreativeTone } from '../creatives'
import type { AttemptStatus, SceneAttempt, SceneProgress } from '../../types/creativeVideos'

/**
 * The video editor's History and its scene timers (2026-11-17): every attempt
 * at a scene (from `GET /admin/creatives/videos/{id}/history`) and the running
 * scene's "Rendering 2 m 10 s · usually about 3 min". Pure, no React.
 */

export const ATTEMPT_STATUS: Record<AttemptStatus, { label: string; tone: CreativeTone }> = {
  made: { label: 'Made', tone: 'green' },
  running: { label: 'Making it', tone: 'accent' },
  waiting: { label: 'Waiting', tone: 'muted' },
  failed: { label: 'Failed', tone: 'red' },
  canceled: { label: 'Cancelled', tone: 'muted' },
  skipped: { label: 'Not started', tone: 'muted' },
}

export function attemptStatusMeta(status: string): { label: string; tone: CreativeTone } {
  return ATTEMPT_STATUS[status as AttemptStatus] ?? { label: status, tone: 'muted' }
}

/** 45 → "45 s", 125 → "2 m 05 s", 3720 → "1 h 02 m". */
export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—'
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s} s`
  if (s < 3600) return `${Math.floor(s / 60)} m ${String(s % 60).padStart(2, '0')} s`
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')} m`
}

/** 170 → "about 3 min", 40 → "about 40 s". */
export function fmtAbout(seconds: number): string {
  if (seconds < 60) return `about ${Math.max(5, Math.round(seconds / 5) * 5)} s`
  return `about ${Math.max(1, Math.round(seconds / 60))} min`
}

/** Seconds since an ISO time, or null. */
export function elapsedSeconds(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? Math.max(0, Math.round((now - t) / 1000)) : null
}

/** Running past this multiple of the usual time = "taking longer than usual". */
export const SLOW_FACTOR = 1.5

export interface ProgressView {
  /** "Still image (1 of 2)" / "Clip" */
  step: string
  elapsed: number | null
  /** "usually about 3 min", when we have enough finished runs. */
  usually: string | null
  slow: boolean
  waiting: boolean
}

export function progressView(p: SceneProgress, now: number): ProgressView {
  const elapsed = elapsedSeconds(p.started_at, now)
  return {
    step: p.steps > 1 ? `${p.step_label} (${p.step} of ${p.steps})` : p.step_label,
    elapsed,
    usually: p.typical_seconds !== null ? `usually ${fmtAbout(p.typical_seconds)}` : null,
    slow: p.typical_seconds !== null && elapsed !== null && elapsed > p.typical_seconds * SLOW_FACTOR,
    waiting: p.waiting,
  }
}

/** The attempts for one scene, newest first (the list is already newest first). */
export function attemptsFor(history: SceneAttempt[] | null, sceneId: number): SceneAttempt[] {
  return (history ?? []).filter((a) => a.scene_id === sceneId)
}

/** How many attempts at this video failed (for the History tab's badge). */
export function failedCount(history: SceneAttempt[] | null): number {
  return (history ?? []).filter((a) => a.status === 'failed').length
}
