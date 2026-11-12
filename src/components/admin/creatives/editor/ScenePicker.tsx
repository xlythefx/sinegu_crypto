import { useEffect, useState } from 'react'
import { Film, LoaderCircle } from 'lucide-react'
import DataState from '../../../dashboard/DataState'
import { BTN_GHOST } from '../../../settings/formClasses'
import { useNow } from '../../../../hooks/useNow'
import { fmtTimeLeft, isExpiredGeneration, msUntilExpiry } from '../../../../lib/creatives'
import { getCreativeGenerations } from '../../../../services/creatives'
import type { CreativeGeneration } from '../../../../types/creatives'
import CreativeModal from '../CreativeModal'

interface ScenePickerProps {
  open: boolean
  title: string
  busy: boolean
  onClose: () => void
  onPick: (generation: CreativeGeneration, outputIndex: number) => void
}

const PAGE = 24

/**
 * Pick a finished video from the Gallery (free — it was already made).
 * Only videos Higgsfield still keeps are offered; each shows how long it has
 * left, since an export must happen before its clips are deleted.
 */
export default function ScenePicker({ open, title, busy, onClose, onPick }: ScenePickerProps) {
  const now = useNow(60_000)
  const [items, setItems] = useState<CreativeGeneration[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const load = async (beforeId?: number) => {
    setLoading(true)
    setError(null)
    try {
      const page = await getCreativeGenerations({ beforeId, limit: PAGE })
      setItems((prev) => [...(beforeId ? (prev ?? []) : []), ...page.generations])
      setHasMore(page.has_more)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const videos = (items ?? []).filter((g) => g.kind === 'video' && g.status === 'completed' && g.outputs.length > 0 && !isExpiredGeneration(g, now))
  const last = items && items.length > 0 ? items[items.length - 1].id : undefined

  return (
    <CreativeModal open={open} title={title} subtitle="Finished videos from the Gallery. Adding one is free." onClose={onClose} maxWidth={760}>
      {!items ? (
        <DataState loading={loading} error={error} onRetry={() => void load()} label="Gallery" />
      ) : videos.length === 0 && !hasMore ? (
        <p className="rounded-row border border-dashed border-border px-4 py-10 text-center text-[13px] text-muted">
          No finished videos in the Gallery yet. Use “Add scenes with AI”, or make one in the Gallery.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {videos.map((g) => {
              const left = msUntilExpiry(g, now)
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onPick(g, 0)}
                    className="group flex w-full cursor-pointer flex-col overflow-hidden rounded-row border border-border bg-surface2 text-left transition-[border-color] duration-150 hover:border-accent-line disabled:cursor-wait disabled:opacity-60"
                  >
                    <span className="relative block aspect-[9/16] max-h-[220px] w-full bg-black">
                      <video src={`${g.outputs[0].url}#t=0.3`} className="h-full w-full object-cover" muted playsInline preload="metadata" aria-hidden="true" />
                    </span>
                    <span className="flex flex-col gap-0.5 px-2.5 py-2">
                      <span className="line-clamp-2 text-[12px] font-semibold leading-[1.35] text-text">{g.prompt}</span>
                      <span className="font-mono text-[10.5px] text-faint">
                        {g.model_label}
                        {left !== null ? ` · ${fmtTimeLeft(left)} left` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {hasMore && (
            <button type="button" className={`${BTN_GHOST} self-center`} onClick={() => void load(last)} disabled={loading}>
              {loading ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <Film size={14} aria-hidden="true" />}
              Show older videos
            </button>
          )}
        </div>
      )}
    </CreativeModal>
  )
}
