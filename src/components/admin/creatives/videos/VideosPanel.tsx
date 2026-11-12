import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Film, LoaderCircle, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import DataState from '../../../dashboard/DataState'
import { useApiData } from '../../../../hooks/useApiData'
import { PLATFORM_LABEL } from '../../../../lib/creatives'
import { editorPath, fmtSeconds } from '../../../../lib/creativeVideos'
import { fmtDateTime } from '../../../../lib/format'
import { getCreativeVideos } from '../../../../services/creativeVideos'
import SectionHeader from '../SectionHeader'
import TonePill from '../TonePill'
import { BTN_SOFT, SECTION } from '../creativeClasses'
import NewVideoModal from './NewVideoModal'

interface VideosPanelProps {
  /** Goes up when the agent made or changed a video — the list re-reads. */
  reloadSignal: number
}

/**
 * Video projects: each is up to 30 seconds of scenes on a timeline, exported
 * as one MP4 from the browser. The agent makes them too ("make a video of
 * this week"); "New project" starts one by hand. A row opens its editor.
 */
export default function VideosPanel({ reloadSignal }: VideosPanelProps) {
  const { data, loading, error, reload } = useApiData(() => getCreativeVideos(30))
  const [creating, setCreating] = useState(false)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    reload()
  }, [reloadSignal, reload])

  return (
    <section className={SECTION} aria-labelledby="creatives-videos">
      <SectionHeader
        icon={Film}
        id="creatives-videos"
        title="Video projects"
        subtitle="Scenes on a timeline, captions, music and a voiceover — one MP4 to download, up to 30 seconds."
        actions={
          <button type="button" className={BTN_SOFT} onClick={() => setCreating(true)}>
            <Plus size={14} aria-hidden="true" />
            New project
          </button>
        }
      />

      {!data ? (
        <DataState loading={loading} error={error} onRetry={reload} label="video projects" />
      ) : data.length === 0 ? (
        <p className="rounded-row border border-dashed border-border px-4 py-10 text-center text-[13px] leading-[1.6] text-muted">
          No video projects yet. Start one here, or ask the agent in Generate mode: “make a 20-second video of this week’s results”.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {data.map((v) => (
            <li key={v.id}>
              <Link
                to={editorPath(v.id)}
                className="group flex min-w-0 items-center gap-3 rounded-row border border-hair bg-surface2/60 p-3.5 no-underline transition-[border-color,background] duration-150 hover:border-accent-line hover:bg-accent-soft sm:p-4"
              >
                <span className="grid h-10 w-10 flex-none place-items-center rounded-[12px] border border-accent-line bg-accent-soft text-accent" aria-hidden="true">
                  {v.scenes_generating > 0 ? <LoaderCircle size={17} className="animate-spin" /> : <Film size={17} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-text">{v.title}</p>
                  <p className="mt-0.5 text-[12px] leading-[1.5] text-muted">
                    {PLATFORM_LABEL[v.platform] ?? v.platform} · {v.aspect}
                    {v.style_name ? ` · ${v.style_name}` : ''} · {v.scenes_ready} of {v.scenes_total} scenes ready · {fmtSeconds(v.duration_ms)}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-faint">
                    {v.created_by_name ? `${v.created_by_name} · ` : ''}updated {fmtDateTime(v.updated_at)}
                  </p>
                </div>
                <div className="flex flex-none flex-col items-end gap-1.5">
                  {v.status === 'exported' ? <TonePill tone="green">Exported</TonePill> : <TonePill tone="muted">Draft</TonePill>}
                  {v.scenes_generating > 0 && <TonePill tone="accent">{v.scenes_generating} making</TonePill>}
                </div>
                <ChevronRight size={16} aria-hidden="true" className="flex-none text-faint group-hover:text-accent" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <NewVideoModal open={creating} onClose={() => setCreating(false)} />
    </section>
  )
}
