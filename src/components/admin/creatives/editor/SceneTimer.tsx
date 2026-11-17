import { Hourglass, Timer } from 'lucide-react'
import { useNow } from '../../../../hooks/useNow'
import { fmtDuration, progressView } from '../../../../lib/videoEditor/history'
import type { SceneProgress } from '../../../../types/creativeVideos'

interface SceneTimerProps {
  progress: SceneProgress
  /** One short line (the timeline tile) instead of the inspector's two. */
  compact?: boolean
}

/**
 * "Making the still image (1 of 2) · 1 m 40 s · usually about 3 min" beside a
 * scene being made, ticking every second. Past 1.5× the usual time it says so
 * and that it carries on by itself — a slow scene must not read as a stuck one.
 */
export default function SceneTimer({ progress, compact = false }: SceneTimerProps) {
  const now = useNow(1000)
  const view = progressView(progress, now)

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 font-mono text-[10px] leading-none ${view.slow ? 'text-red' : 'text-accent'}`}>
        <Timer size={10} aria-hidden="true" />
        {view.waiting ? 'waiting' : fmtDuration(view.elapsed)}
      </span>
    )
  }

  return (
    <div
      className={`flex flex-col gap-1 rounded-row border px-3 py-2.5 text-[12.5px] leading-[1.5] ${
        view.slow ? 'border-[rgba(255,99,99,0.35)] bg-[rgba(255,99,99,0.06)]' : 'border-accent-line bg-accent-soft'
      }`}
      role="status"
    >
      <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-semibold text-text">
        {view.waiting ? <Hourglass size={13} aria-hidden="true" className="text-accent" /> : <Timer size={13} aria-hidden="true" className="text-accent" />}
        {view.waiting ? `Waiting to start: ${view.step}` : `Making the ${view.step.charAt(0).toLowerCase()}${view.step.slice(1)}`}
        {view.elapsed !== null && <span className="font-mono text-[12px] text-muted">· {fmtDuration(view.elapsed)}</span>}
        {view.usually && <span className="font-normal text-muted">· {view.usually}</span>}
      </span>
      {view.slow ? (
        <span className="text-muted">
          Taking longer than usual. Higgsfield is probably busy; it carries on by itself, and nothing is charged if it fails.
        </span>
      ) : (
        progress.steps > 1 &&
        progress.step === 1 && <span className="text-muted">Kling makes a still image first, then animates it.</span>
      )}
    </div>
  )
}
