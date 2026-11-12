import { useEffect, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, Clock, Download, LoaderCircle, MonitorSmartphone, TriangleAlert } from 'lucide-react'
import { BTN_GHOST, BTN_PRIMARY } from '../../../settings/formClasses'
import { fmtTimeLeft } from '../../../../lib/creatives'
import { exportSize, fmtSeconds, isSceneExpired, soonestExpiryMs } from '../../../../lib/creativeVideos'
import { browserEnv, exportSupport, type ExportSupport } from '../../../../lib/videoEditor/support'
import { overCap, totalMs } from '../../../../lib/videoEditor/timeline'
import type { ExportProgress } from '../../../../lib/videoEditor/export'
import { getCreativeGeneration } from '../../../../services/creatives'
import type { CreativeAudioAsset, CreativeVideo } from '../../../../types/creativeVideos'
import CreativeModal from '../CreativeModal'
import { NOTICE } from '../creativeClasses'

interface ExportDialogProps {
  open: boolean
  video: CreativeVideo
  readAt: number
  now: number
  audio: CreativeAudioAsset[]
  /** Below 768 px: preview only. */
  narrow: boolean
  /** Unsaved edits are saved before the export starts. */
  flush: () => Promise<boolean>
  onClose: () => void
  onExported: (stats: { seconds: number; bytes: number }) => void
}

type Stage = 'checking' | 'ready' | 'blocked' | 'running' | 'done' | 'error'

const PHASE_LABEL: Record<ExportProgress['phase'], string> = {
  clips: 'Fetching the clips',
  audio: 'Mixing the sound',
  encoding: 'Encoding the video',
  done: 'Done',
}

/** Overall progress: fetching 0–25%, sound 25–35%, encoding 35–100%. */
function overall(p: ExportProgress | null): number {
  if (!p) return 0
  const f = p.total > 0 ? p.done / p.total : 0
  if (p.phase === 'clips') return 25 * f
  if (p.phase === 'audio') return 25 + 10 * f
  if (p.phase === 'encoding') return 35 + 65 * f
  return 100
}

/**
 * Export MP4: checks first (this browser can encode; every scene is ready
 * and still kept by Higgsfield; within 30 s), then fetches the clips, mixes
 * the sound and encodes in the browser — nothing is uploaded, and the server
 * keeps only a note that it was exported. Then the file downloads.
 */
export default function ExportDialog({ open, video, readAt, now, audio, narrow, flush, onClose, onExported }: ExportDialogProps) {
  const [stage, setStage] = useState<Stage>('checking')
  const [support, setSupport] = useState<ExportSupport | null>(null)
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ blob: Blob; seconds: number; bytes: number } | null>(null)
  const abort = useRef<AbortController | null>(null)

  const { width, height } = exportSize(video.aspect)
  const total = totalMs(video.scenes)
  const expired = video.scenes.filter((s) => isSceneExpired(s, now))
  const notReady = video.scenes.filter((s) => s.kind === 'clip' && !isSceneExpired(s, now) && s.status !== 'ready')
  const tooLong = overCap(video.scenes, video.max_seconds)
  const soonest = soonestExpiryMs(video.scenes, now)

  const blockers: string[] = []
  if (narrow) blockers.push('Exporting needs a computer — on a phone the editor is for viewing and reordering.')
  if (video.scenes.length === 0) blockers.push('Add at least one scene first.')
  if (expired.length > 0) blockers.push(`${expired.length === 1 ? 'One clip was' : `${expired.length} clips were`} deleted by Higgsfield (${expired.map((s) => `“${s.label}”`).join(', ')}). Replace or regenerate ${expired.length === 1 ? 'it' : 'them'} first.`)
  if (notReady.length > 0) blockers.push(`${notReady.length === 1 ? 'One scene is' : `${notReady.length} scenes are`} not ready yet (${notReady.map((s) => `“${s.label}”`).join(', ')}). Wait for the clips, or remove those scenes.`)
  if (tooLong) blockers.push(`The video is ${fmtSeconds(total)} — trim it to ${video.max_seconds} seconds or less.`)

  // Check the browser each time the dialog opens.
  useEffect(() => {
    if (!open) return
    let alive = true
    setStage('checking')
    setError(null)
    setProgress(null)
    setResult(null)
    void (async () => {
      const { canEncodeAudio } = await import('mediabunny')
      const s = await exportSupport(width, height, {
        ...browserEnv(),
        canEncodeAac: () => canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: 48_000 }),
      })
      if (!alive) return
      setSupport(s)
      setStage(s.ok ? 'ready' : 'blocked')
    })().catch(() => {
      if (alive) {
        setSupport({ ok: false, reason: 'Export works in Chrome, Edge or Safari 26+.', needsAacWasm: false, codec: null })
        setStage('blocked')
      }
    })
    return () => {
      alive = false
    }
  }, [open, width, height])

  useEffect(() => {
    if (!open) abort.current?.abort()
  }, [open])

  const start = async () => {
    if (!support?.ok || !support.codec || blockers.length > 0) return
    setStage('running')
    setError(null)
    setProgress(null)
    const ctrl = new AbortController()
    abort.current = ctrl
    try {
      await flush()
      const { exportVideo, exportFilename, saveBlob } = await import('../../../../lib/videoEditor/export')
      const res = await exportVideo({
        video,
        readAt,
        refresh: getCreativeGeneration,
        audioAssets: audio,
        codec: support.codec,
        onProgress: setProgress,
        signal: ctrl.signal,
      })
      setResult(res)
      setStage('done')
      saveBlob(res.blob, exportFilename(video.id))
      onExported({ seconds: res.seconds, bytes: res.bytes })
    } catch (err) {
      if (ctrl.signal.aborted) {
        setStage('ready')
        return
      }
      setError(err instanceof Error ? err.message : 'The export stopped.')
      setStage('error')
    } finally {
      abort.current = null
    }
  }

  const pct = Math.round(overall(progress))
  const running = stage === 'running'

  return (
    <CreativeModal
      open={open}
      title="Export the video"
      subtitle={`One MP4, ${width}×${height}, 30 frames a second, ${fmtSeconds(total)}. Made in this browser — it can take a minute or two.`}
      onClose={() => {
        if (running) abort.current?.abort()
        onClose()
      }}
      maxWidth={560}
    >
      <div className="flex flex-col gap-4">
        {stage === 'checking' && (
          <p className="inline-flex items-center gap-2 text-[13px] text-muted" role="status">
            <LoaderCircle size={15} aria-hidden="true" className="animate-spin text-accent" />
            Checking this browser…
          </p>
        )}

        {stage === 'blocked' && support?.reason && (
          <p className={NOTICE.warn} role="status">
            <MonitorSmartphone size={15} aria-hidden="true" />
            {support.reason}
          </p>
        )}

        {stage !== 'checking' && blockers.length > 0 && (
          <ul className="flex flex-col gap-2">
            {blockers.map((b) => (
              <li key={b} className={NOTICE.warn}>
                <TriangleAlert size={15} aria-hidden="true" />
                {b}
              </li>
            ))}
          </ul>
        )}

        {soonest !== null && blockers.length === 0 && stage !== 'done' && (
          <p className="inline-flex items-start gap-2 text-[12.5px] leading-[1.55] text-muted">
            <Clock size={14} aria-hidden="true" className="mt-0.5 flex-none" />
            Higgsfield deletes this video’s first clip in {fmtTimeLeft(soonest)}. Export before then — afterwards it has to be made again.
          </p>
        )}

        {(running || stage === 'done') && (
          <div className="flex flex-col gap-2" role="status" aria-live="polite">
            <div className="flex items-center justify-between text-[12.5px] font-semibold text-text">
              <span>{progress ? `${PHASE_LABEL[progress.phase]}${progress.phase === 'clips' ? ` (${progress.done} of ${progress.total})` : ''}…` : 'Starting…'}</span>
              <span className="font-mono tabular-nums text-muted">{pct}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-pill border border-border bg-surface2">
              <div className="h-full rounded-pill bg-accent transition-[width] duration-200" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {stage === 'done' && result && (
          <p className={NOTICE.success} role="status">
            <CircleCheck size={15} aria-hidden="true" />
            Exported — {(result.bytes / 1024 / 1024).toFixed(1)} MB. The download has started; use the button below if it did not.
          </p>
        )}
        {stage === 'error' && error && (
          <p className={NOTICE.error} role="alert">
            <CircleAlert size={15} aria-hidden="true" />
            The export stopped: {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2.5 border-t border-hair pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            className={BTN_GHOST}
            onClick={() => {
              if (running) abort.current?.abort()
              else onClose()
            }}
          >
            {running ? 'Cancel the export' : 'Close'}
          </button>
          {stage === 'done' && result ? (
            <button
              type="button"
              className={BTN_PRIMARY}
              onClick={() => void import('../../../../lib/videoEditor/export').then((m) => m.saveBlob(result.blob, m.exportFilename(video.id)))}
            >
              <Download size={14} aria-hidden="true" />
              Download again
            </button>
          ) : (
            <button
              type="button"
              className={BTN_PRIMARY}
              onClick={() => void start()}
              disabled={stage !== 'ready' && stage !== 'error' ? true : blockers.length > 0}
            >
              {running ? <LoaderCircle size={14} aria-hidden="true" className="animate-spin" /> : <Download size={14} aria-hidden="true" />}
              {running ? 'Exporting…' : stage === 'error' ? 'Try again' : 'Export MP4'}
            </button>
          )}
        </div>
      </div>
    </CreativeModal>
  )
}
