import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CircleAlert, CircleCheck, Download, Film, LayoutTemplate, LoaderCircle, Sparkles, Trash2, TriangleAlert } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import DataState from '../../../dashboard/DataState'
import ConfirmModal from '../../../ui/ConfirmModal'
import { Segmented } from '../../../ui/filters'
import { useApiData } from '../../../../hooks/useApiData'
import { useCreativeAudio } from '../../../../hooks/useCreativeAudio'
import { useCreativeVideo } from '../../../../hooks/useCreativeVideo'
import { useEditorPlayback } from '../../../../hooks/useEditorPlayback'
import { useIsMobile } from '../../../../hooks/useIsMobile'
import { useNow } from '../../../../hooks/useNow'
import { usePreviewSoundtrack } from '../../../../hooks/usePreviewSoundtrack'
import { creativeErrorMessage, PLATFORM_LABEL, startSignedDownload } from '../../../../lib/creatives'
import { getCreativeGeneration } from '../../../../services/creatives'
import { getCreativeStyles } from '../../../../services/creativesAgent'
import { fmtSeconds, isSceneExpired } from '../../../../lib/creativeVideos'
import { sceneSpans, totalMs as sumMs } from '../../../../lib/videoEditor/timeline'
import type { CreativeBudget, CreativeGeneration, CreativesMeta } from '../../../../types/creatives'
import type { CreativeVideoScene, SceneDraft, SceneEngine, TemplateFields } from '../../../../types/creativeVideos'
import JobCard from '../agent/job/JobCard'
import TonePill from '../TonePill'
import { BTN_SOFT, BTN_SOFT_DANGER, NOTICE } from '../creativeClasses'
import AudioPanel from './AudioPanel'
import CaptionsEditor from './CaptionsEditor'
import EditorJobStrip from './EditorJobStrip'
import ExportDialog from './ExportDialog'
import LookPanel from './LookPanel'
import PreviewPlayer from './PreviewPlayer'
import ProposeScenesModal from './ProposeScenesModal'
import SceneInspector from './SceneInspector'
import ScenePicker from './ScenePicker'
import TemplateEditor from './TemplateEditor'
import Timeline, { type EditorSelection } from './Timeline'
import { PANE } from './editorClasses'

interface EditorWorkspaceProps {
  videoId: number
  meta: CreativesMeta
  budget: CreativeBudget
  onBudget: (b: CreativeBudget) => void
}

type Tab = 'scenes' | 'captions' | 'audio' | 'look'

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'scenes', label: 'Scenes' },
  { value: 'captions', label: 'Captions' },
  { value: 'audio', label: 'Sound' },
  { value: 'look', label: 'Look' },
]

const GO_BTN =
  'inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-field border border-transparent bg-accent px-4 text-[13px] font-extrabold text-on-accent shadow-[0_10px_24px_var(--glow)] transition-[filter,opacity] duration-150 hover:brightness-[1.06] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none'

/**
 * The video editor (Creatives v2): the preview and the inspector side by side
 * on a computer, the timeline under them, stacked on a phone (view and
 * reorder only — export needs a computer). Clips are generated together
 * from "Add scenes with AI" (a priced job; Go spends), land in their slots
 * as they finish, and the whole thing exports as one MP4 in the browser.
 */
export default function EditorWorkspace({ videoId, meta, budget, onBudget }: EditorWorkspaceProps) {
  const navigate = useNavigate()
  const narrow = useIsMobile(768)
  const now = useNow(30_000)
  const v = useCreativeVideo(videoId, onBudget)
  const library = useCreativeAudio()
  const { data: styles } = useApiData(getCreativeStyles)
  const video = v.video
  const spans = useMemo(() => (video ? sceneSpans(video.scenes) : []), [video])
  const total = video ? sumMs(video.scenes) : 0
  const play = useEditorPlayback(total)
  const sound = usePreviewSoundtrack({
    timeline: video?.timeline ?? null,
    totalMs: total,
    assets: library.audio ?? [],
    playing: play.playing,
    timeRef: play.timeRef,
    seekNonce: play.seekNonce,
  })

  const [tab, setTab] = useState<Tab>('scenes')
  const [selection, setSelection] = useState<EditorSelection>(null)
  const [picker, setPicker] = useState<{ replace: CreativeVideoScene | null } | null>(null)
  const [cardEditor, setCardEditor] = useState<{ scene: CreativeVideoScene | null; fields: TemplateFields | null } | null>(null)
  const [propose, setPropose] = useState<{ replace: CreativeVideoScene | null } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (selection?.kind === 'caption') setTab('captions')
    if (selection?.kind === 'sfx') setTab('audio')
    if (selection?.kind === 'scene') setTab('scenes')
  }, [selection])

  const onToggle = useCallback(() => {
    sound.unlock()
    play.toggle()
  }, [sound, play])

  // Space plays / pauses (outside text fields).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const t = e.target as HTMLElement | null
      if (t && (t.closest('input, textarea, select, button, [contenteditable="true"]') || document.querySelector('[role="dialog"][aria-modal="true"]'))) return
      e.preventDefault()
      onToggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onToggle])

  if (!video) {
    return (
      <div className="flex flex-col gap-4">
        <Link to="/admin/creatives?panel=videos" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted no-underline hover:text-accent">
          <ArrowLeft size={15} aria-hidden="true" />
          Video projects
        </Link>
        <DataState loading={v.loading} error={v.error} onRetry={v.reload} label="video project" />
      </div>
    )
  }

  const style = video.style
  const locked = video.scenes.some((s) => s.kind === 'clip' && s.generation)
  const openJobs = video.jobs.filter((j) => j.status === 'proposed' || j.status === 'running')
  // A finished job with failed scenes is mentioned only while a failed scene is still on the timeline.
  const recentJobs = video.scenes.some((s) => s.status === 'failed')
    ? video.jobs.filter((j) => j.status === 'completed_with_failures' || j.status === 'failed').slice(0, 1)
    : []
  const expiredCount = video.scenes.filter((s) => isSceneExpired(s, now)).length
  const selectedSceneId = selection?.kind === 'scene' ? selection.id : null
  const styleRow = style ? styles?.find((s) => s.id === style.id) : undefined
  const defaultEngine: SceneEngine = styleRow?.default_engine ?? 'kling'
  const family: 'pixel' | 'clean' =
    styleRow?.template_family ?? (video.timeline.caption_style === 'pixel' || video.timeline.look.pixel_size > 0 ? 'pixel' : 'clean')

  /** A job step's file, through a freshly signed link. */
  const download = async (g: CreativeGeneration, index: number): Promise<string | null> => {
    try {
      const fresh = await getCreativeGeneration(g.id)
      const path = fresh?.outputs[index]?.download_path ?? null
      if (!path) return `Higgsfield has deleted this file — results are only kept for ${meta.retention_days} days.`
      startSignedDownload(path)
      return null
    } catch (err) {
      return creativeErrorMessage(err, 'Could not start the download.')
    }
  }

  const regenerateDraft = (s: CreativeVideoScene): SceneDraft => ({
    kind: 'clip',
    label: s.label,
    prompt: s.prompt ?? '',
    seconds: s.seconds || 5,
    engine: s.engine ?? defaultEngine,
    with_character: s.with_character,
    caption: null,
    template: null,
  })

  const onPick = async (g: CreativeGeneration, index: number) => {
    const replace = picker?.replace ?? null
    const ok = replace ? await v.replaceClip(replace.id, g.id, index) : await v.addClip(g.id, index)
    if (ok) setPicker(null)
  }

  const saveState = v.saving ? (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
      <LoaderCircle size={13} aria-hidden="true" className="animate-spin" />
      Saving…
    </span>
  ) : v.saveError ? (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-red">
      <CircleAlert size={13} aria-hidden="true" />
      Not saved
    </span>
  ) : v.dirty ? (
    <span className="text-[12px] text-muted">Unsaved changes</span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
      <CircleCheck size={13} aria-hidden="true" className="text-green" />
      Saved
    </span>
  )

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-3 animate-[fadeup_0.35s_ease-out]">
        <Link to="/admin/creatives?panel=videos" className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-muted no-underline hover:text-accent">
          <ArrowLeft size={15} aria-hidden="true" />
          Video projects
        </Link>
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <div className="flex min-w-[220px] flex-1 flex-col gap-2">
            <input
              value={video.title}
              maxLength={160}
              onChange={(e) => v.setTitle(e.target.value)}
              aria-label="Title"
              className="w-full min-w-0 rounded-field border border-transparent bg-transparent px-1 py-0.5 font-display text-[22px] font-extrabold tracking-[-0.02em] text-text outline-none transition-[border-color,background] duration-150 hover:border-border focus:border-accent-line focus:bg-surface sm:text-[26px]"
            />
            <div className="flex flex-wrap items-center gap-1.5 px-1">
              <TonePill tone="muted">{PLATFORM_LABEL[video.platform] ?? video.platform}</TonePill>
              <TonePill tone="muted" title={locked ? 'Fixed once a clip has been made' : undefined}>
                {video.aspect}
              </TonePill>
              <TonePill tone={style ? 'accent' : 'muted'}>{style ? style.name : 'No style'}</TonePill>
              <TonePill tone={video.status === 'exported' ? 'green' : 'muted'}>{video.status === 'exported' ? 'Exported' : 'Draft'}</TonePill>
              <span className="ml-1 font-mono text-[11.5px] text-faint">
                {fmtSeconds(total)} of {video.max_seconds} s
              </span>
              <span className="ml-1">{saveState}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 max-sm:w-full">
            <button type="button" className={GO_BTN} onClick={() => setExporting(true)} disabled={narrow || video.scenes.length === 0} title={narrow ? 'Export needs a computer' : undefined}>
              <Download size={15} aria-hidden="true" />
              Export MP4
            </button>
            <button type="button" className={BTN_SOFT_DANGER} onClick={() => setConfirmDelete(true)} disabled={!!v.busy}>
              <Trash2 size={14} aria-hidden="true" />
              <span className="max-sm:sr-only">Delete project</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notices */}
      {v.saveError && (
        <p className={NOTICE.error} role="alert">
          <CircleAlert size={15} aria-hidden="true" />
          {v.saveError}
        </p>
      )}
      {v.actionError && (
        <p className={NOTICE.error} role="alert">
          <CircleAlert size={15} aria-hidden="true" />
          {v.actionError}
        </p>
      )}
      {expiredCount > 0 && (
        <p className={NOTICE.warn} role="status">
          <TriangleAlert size={15} aria-hidden="true" />
          {expiredCount === 1 ? 'One clip was' : `${expiredCount} clips were`} deleted by Higgsfield (results are kept {meta.retention_days} days). Replace or regenerate {expiredCount === 1 ? 'it' : 'them'} before exporting.
        </p>
      )}
      {narrow && (
        <p className={NOTICE.info} role="status">
          <Film size={15} aria-hidden="true" />
          On a phone you can watch, reorder and check the scenes. Open the editor on a computer to trim precisely and export.
        </p>
      )}
      {sound.problem && (
        <p className={NOTICE.warn} role="status">
          <TriangleAlert size={15} aria-hidden="true" />
          {sound.problem}
        </p>
      )}

      {/* Jobs: a priced proposal waits for Go; a running one lands clips in their slots. */}
      {openJobs.map((job) =>
        job.status === 'proposed' ? (
          <div key={job.id} className="animate-[fadeup_0.35s_ease-out]">
            <JobCard
              job={job}
              budget={budget}
              now={now}
              retentionDays={meta.retention_days}
              configured={meta.configured}
              busy={v.jobBusy[job.id]}
              error={v.jobErrors[job.id]}
              onApprove={(j) => void v.approveJob(j)}
              onCancel={(j) => void v.cancelJob(j)}
              onOpenPlan={() => navigate(`/admin/creatives?panel=plans&plan=${job.plan_id}`)}
              onOpenGallery={() => navigate('/admin/creatives?panel=gallery')}
              onDownload={download}
              hideGallery
            />
          </div>
        ) : (
          <EditorJobStrip key={job.id} job={job} busy={!!v.jobBusy[job.id]} error={v.jobErrors[job.id]} onCancel={(j) => void v.cancelJob(j)} />
        ),
      )}
      {recentJobs.map((job) => (
        <EditorJobStrip key={job.id} job={job} busy={false} error={undefined} onCancel={() => undefined} />
      ))}

      {/* Preview + inspector */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
        <section className={`${PANE} items-stretch`} aria-label="Preview">
          <PreviewPlayer
            video={video}
            spans={spans}
            totalMs={total}
            timeRef={play.timeRef}
            timeMs={play.timeMs}
            playing={play.playing}
            now={now}
            onToggle={onToggle}
            onSeek={play.seek}
          />
          {sound.preparing && <p className="text-center text-[11.5px] text-faint">Preparing the sound…</p>}
        </section>

        <section className={`${PANE} lg:max-h-[calc(100dvh-140px)] lg:overflow-y-auto [scrollbar-width:thin]`} aria-label="Inspector">
          <Segmented value={tab} onChange={setTab} options={TABS} ariaLabel="Inspector" size="sm" />
          <div key={tab} className="animate-[fadeup_0.3s_ease-out]">
            {tab === 'scenes' && (
              <SceneInspector
                scenes={video.scenes}
                spans={spans}
                selectedId={selectedSceneId}
                now={now}
                busy={!!v.busy}
                onSelect={(id) => setSelection({ kind: 'scene', id })}
                onMove={v.moveScene}
                onLabel={(id, label) => v.updateScene(id, { label })}
                onTrim={(id, patch) => v.updateScene(id, patch)}
                onReplaceClip={(scene) => setPicker({ replace: scene })}
                onRegenerate={(scene) => {
                  v.clearActionError()
                  setPropose({ replace: scene })
                }}
                onEditCard={(scene, fields) => setCardEditor({ scene, fields })}
                onRemove={(scene) => {
                  void v.removeScene(scene.id)
                  setSelection(null)
                }}
                onSeek={play.seek}
              />
            )}
            {tab === 'captions' && (
              <CaptionsEditor
                timeline={video.timeline}
                totalMs={total}
                timeMs={play.timeMs}
                selectedId={selection?.kind === 'caption' ? selection.id : null}
                onSelect={(id) => setSelection({ kind: 'caption', id })}
                onTimeline={v.updateTimeline}
              />
            )}
            {tab === 'audio' && (
              <AudioPanel
                timeline={video.timeline}
                totalMs={total}
                timeMs={play.timeMs}
                library={library}
                selectedSfx={selection?.kind === 'sfx' ? selection.id : null}
                onSelectSfx={(id) => setSelection({ kind: 'sfx', id })}
                onTimeline={v.updateTimeline}
              />
            )}
            {tab === 'look' && <LookPanel timeline={video.timeline} onTimeline={v.updateTimeline} />}
          </div>
        </section>
      </div>

      {/* Timeline */}
      <section className={PANE} aria-label="Timeline">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={GO_BTN}
            onClick={() => {
              v.clearActionError()
              setPropose({ replace: null })
            }}
            disabled={!!v.busy}
          >
            <Sparkles size={15} aria-hidden="true" />
            Add scenes with AI
          </button>
          <button type="button" className={BTN_SOFT} onClick={() => setPicker({ replace: null })} disabled={!!v.busy}>
            <Film size={14} aria-hidden="true" />
            From the Gallery
          </button>
          <button type="button" className={BTN_SOFT} onClick={() => setCardEditor({ scene: null, fields: null })} disabled={!!v.busy}>
            <LayoutTemplate size={14} aria-hidden="true" />
            Template card · free
          </button>
          {v.busy && <LoaderCircle size={15} aria-hidden="true" className="animate-spin text-accent" />}
        </div>
        <Timeline
          video={video}
          spans={spans}
          totalMs={total}
          timeMs={play.timeMs}
          now={now}
          selection={selection}
          onSelect={setSelection}
          onSeek={play.seek}
          onTrim={(id, patch) => v.updateScene(id, patch)}
          onTimeline={v.updateTimeline}
          audio={library.audio ?? []}
          onOpenAudio={() => setTab('audio')}
        />
        {v.tooLong && (
          <p className={NOTICE.warn} role="status">
            <TriangleAlert size={15} aria-hidden="true" />
            The video is over {video.max_seconds} seconds. Trim a scene (drag its edges) or remove one — it can’t be saved or exported until then.
          </p>
        )}
      </section>

      {/* Dialogs */}
      <ScenePicker
        open={picker !== null}
        title={picker?.replace ? `Replace “${picker.replace.label}”` : 'Add a clip from the Gallery'}
        busy={!!v.busy}
        onClose={() => setPicker(null)}
        onPick={(g, i) => void onPick(g, i)}
      />
      <TemplateEditor
        open={cardEditor !== null}
        aspect={video.aspect}
        initial={cardEditor?.fields ?? null}
        family={family}
        busy={!!v.busy}
        onClose={() => setCardEditor(null)}
        onSave={(fields, seconds) => {
          const scene = cardEditor?.scene
          if (scene) {
            v.updateScene(scene.id, { template: fields })
            setCardEditor(null)
          } else {
            void v.addTemplate(fields, seconds).then((ok) => ok && setCardEditor(null))
          }
        }}
      />
      <ProposeScenesModal
        open={propose !== null}
        replace={propose?.replace ? { sceneId: propose.replace.id, draft: regenerateDraft(propose.replace), durationMs: propose.replace.duration_ms } : null}
        defaultEngine={defaultEngine}
        templateFamily={family}
        usedMs={total}
        capMs={video.max_seconds * 1000}
        busy={v.busy === 'propose'}
        error={v.actionError}
        onClose={() => setPropose(null)}
        onSubmit={(drafts, replaceId) =>
          void v.propose(drafts, replaceId).then((job) => {
            if (job !== false) setPropose(null)
          })
        }
      />
      <ExportDialog
        open={exporting}
        video={video}
        readAt={v.readAt}
        now={now}
        audio={library.audio ?? []}
        narrow={narrow}
        flush={v.flush}
        onClose={() => setExporting(false)}
        onExported={(stats) => void v.markExported(stats)}
      />
      <ConfirmModal
        open={confirmDelete}
        title={`Delete “${video.title}”?`}
        message="The project, its scenes, captions and sound settings are deleted. The clips themselves stay in the Gallery until Higgsfield deletes them, and the audio library is not touched."
        confirmLabel="Delete project"
        cancelLabel="Keep it"
        danger
        onConfirm={() => {
          setConfirmDelete(false)
          void v.deleteVideo().then((ok) => ok && navigate('/admin/creatives?panel=videos'))
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
