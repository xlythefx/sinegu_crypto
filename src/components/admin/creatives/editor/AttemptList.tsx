import { fmtDateTime } from '../../../../lib/format'
import { attemptStatusMeta, elapsedSeconds, fmtDuration } from '../../../../lib/videoEditor/history'
import type { SceneAttempt } from '../../../../types/creativeVideos'
import TonePill from '../TonePill'

interface AttemptListProps {
  attempts: SceneAttempt[]
  now: number
  /** Show which scene each attempt was for (the whole-video History). */
  showScene?: boolean
  /** Click a row: pick its scene. */
  onPickScene?: (sceneId: number) => void
}

const usd = (n: number) => (n > 0 ? `$${n.toFixed(n < 0.1 ? 3 : 2)}` : '$0')

/**
 * Every attempt, newest first: what step, which engine, how long, made or
 * failed and Higgsfield's own reason, what it cost (a failed one costs
 * nothing) and who started it. A retry adds a row; it never replaces one.
 */
export default function AttemptList({ attempts, now, showScene = false, onPickScene }: AttemptListProps) {
  return (
    <ol className="flex flex-col gap-1.5">
      {attempts.map((a) => {
        const meta = attemptStatusMeta(a.status)
        const seconds = a.status === 'running' ? elapsedSeconds(a.started_at, now) : a.seconds
        const clickable = showScene && onPickScene && a.scene_id !== null && a.scene_position !== null
        const body = (
          <>
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <TonePill tone={meta.tone}>{meta.label}</TonePill>
              <span className="min-w-0 text-[12.5px] font-semibold text-text">
                {showScene && (
                  <>
                    {a.scene_position !== null ? `Scene ${a.scene_position + 1}` : 'Removed scene'}
                    {a.scene_label ? ` · ${a.scene_label}` : ''}
                    {' · '}
                  </>
                )}
                {a.role}
              </span>
              <span className="text-[11.5px] text-muted">{a.model_label}</span>
            </div>
            {a.error && a.status !== 'made' && (
              <p className={`text-[12px] leading-[1.5] [overflow-wrap:anywhere] ${a.status === 'failed' ? 'font-semibold text-red' : 'text-muted'}`}>{a.error}</p>
            )}
            {a.status === 'skipped' && !a.error && (
              <p className="text-[12px] leading-[1.5] text-muted">Never started: the step before it did not finish.</p>
            )}
            <p className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10.5px] leading-[1.5] text-faint">
              {a.started_at && <span>{fmtDateTime(a.started_at)}</span>}
              {seconds !== null && <span>{a.status === 'running' ? 'running ' : 'took '}{fmtDuration(seconds)}</span>}
              {a.status !== 'waiting' && a.status !== 'skipped' && <span>{usd(a.usd)}</span>}
              {(a.approved_by ?? a.started_by) && <span>by {a.approved_by ?? a.started_by}</span>}
            </p>
          </>
        )
        return (
          <li key={a.id}>
            {clickable ? (
              <button
                type="button"
                onClick={() => onPickScene(a.scene_id as number)}
                className="flex w-full min-w-0 cursor-pointer flex-col gap-1.5 rounded-row border border-hair bg-surface2/60 px-3 py-2.5 text-left transition-colors duration-150 hover:border-accent-line"
              >
                {body}
              </button>
            ) : (
              <div className="flex min-w-0 flex-col gap-1.5 rounded-row border border-hair bg-surface2/60 px-3 py-2.5">{body}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
