import DataState from '../../../dashboard/DataState'
import { failedCount } from '../../../../lib/videoEditor/history'
import type { SceneAttempt } from '../../../../types/creativeVideos'
import AttemptList from './AttemptList'

interface HistoryPanelProps {
  history: SceneAttempt[] | null
  loading: boolean
  error: unknown
  onRetry: () => void
  now: number
  onPickScene: (sceneId: number) => void
}

/**
 * The History tab: every attempt at this video's scenes, newest first — so
 * when a scene fails, the reason (and every earlier try) is still here after
 * it has been regenerated. Clicking a row picks its scene.
 */
export default function HistoryPanel({ history, loading, error, onRetry, now, onPickScene }: HistoryPanelProps) {
  if (!history) return <DataState loading={loading} error={error} onRetry={onRetry} label="history" />
  if (history.length === 0) {
    return (
      <p className="rounded-row border border-dashed border-border px-4 py-8 text-center text-[13px] leading-[1.6] text-muted">
        Nothing made for this video yet. Every attempt shows here once a scene is started with Go: how long it took, whether it worked, and why not.
      </p>
    )
  }
  const failed = failedCount(history)
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] leading-[1.55] text-muted">
        {history.length} {history.length === 1 ? 'attempt' : 'attempts'}
        {failed > 0 ? ` · ${failed} failed (nothing is charged for a failed one)` : ''}. Newest first; click one to pick its scene.
      </p>
      <AttemptList attempts={history} now={now} showScene onPickScene={onPickScene} />
    </div>
  )
}
