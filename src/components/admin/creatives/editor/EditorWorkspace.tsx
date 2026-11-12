import { useCallback, useEffect, useMemo, useRef, useState, type RefCallback } from 'react'
import { ArrowLeft, CircleAlert, CircleCheck, Film, LayoutTemplate, LoaderCircle, MessageSquare, PanelRightOpen, Sparkles, TriangleAlert } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import DataState from '../../../dashboard/DataState'
import ConfirmModal from '../../../ui/ConfirmModal'
import { Segmented } from '../../../ui/filters'
import { useApiData } from '../../../../hooks/useApiData'
import { useCreativeAgent } from '../../../../hooks/useCreativeAgent'
import { useCreativeAudio } from '../../../../hooks/useCreativeAudio'
import { useCreativeVideo } from '../../../../hooks/useCreativeVideo'
import { useEditorPlayback } from '../../../../hooks/useEditorPlayback'
import { useIsMobile } from '../../../../hooks/useIsMobile'
import { useNow } from '../../../../hooks/useNow'
import { usePreviewSoundtrack } from '../../../../hooks/usePreviewSoundtrack'
import { useStoredFlag } from '../../../../hooks/useStoredFlag'
import { creativeErrorMessage, startSignedDownload } from '../../../../lib/creatives'
import { changesVideo, jobsFingerprint } from '../../../../lib/creativesAgent'
import { getCreativeGeneration } from '../../../../services/creatives'
import { getCreativeStyles } from '../../../../services/creativesAgent'
import { isSceneExpired } from '../../../../lib/creativeVideos'
import {
  clickSelect,
  focusChips,
  focusIds,
  improvePrompt,
  marqueeSelect,
  NO_SELECTION,
  pruneSelection,
  type ClickModifiers,
  type SceneSelection,
} from '../../../../lib/videoEditor/selection'
import { sceneSpans, totalMs as sumMs } from '../../../../lib/videoEditor/timeline'
import type { CreativeAgentJob, CreativeBudget, CreativeGeneration, CreativesMeta } from '../../../../types/creatives'
import type { CreativeVideoScene, SceneDraft, SceneEngine, TemplateFields, VideoAspect } from '../../../../types/creativeVideos'
import JobCard from '../agent/job/JobCard'
import CreativeModal from '../CreativeModal'
import { NOTICE } from '../creativeClasses'
import { AdminMenuButton } from '../../AdminLayout'
import AudioPanel from './AudioPanel'
import CaptionsEditor from './CaptionsEditor'
import EditorChatPanel from './EditorChatPanel'
import EditorHeader from './EditorHeader'
import EditorJobStrip from './EditorJobStrip'
import ExportDialog from './ExportDialog'
import LookPanel from './LookPanel'
import PreviewPlayer from './PreviewPlayer'
import ProposeScenesModal from './ProposeScenesModal'
import SceneInspector from './SceneInspector'
import ScenePicker from './ScenePicker'
import TemplateEditor from './TemplateEditor'
import Timeline, { type EditorSelection } from './Timeline'
import { PANE, PANE_TIGHT } from './editorClasses'

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

/** Whether the docked chat is open, remembered on this device. */
const CHAT_OPEN_KEY = 'pixel-alpha.creatives.editor-chat-open'

/** The preview's widest, per shape — a wide video hits it before the screen's height does. */
const PREVIEW_MAX_W: Record<VideoAspect, number> = { '9:16': 340, '1:1': 380, '16:9': 480 }
/** Room the scene list keeps beside the preview. */
const INSPECTOR_MIN_W = 320
/** The preview pane's padding, play bar and gap, under the picture. */
const PREVIEW_CHROME_PX = 66

const ADD_BTN =
  'inline-flex min-h-8 cursor-pointer items-center justify-center gap-1.5 rounded-field border px-2.5 text-[12px] font-bold transition-[border-color,background,filter,opacity] duration-150 disabled:cursor-not-allowed disabled:opacity-50'

/** Width and height of an element, live. */
function useBoxSize<T extends HTMLElement>(): [RefCallback<T>, { width: number; height: number }] {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const ro = useRef<ResizeObserver | null>(null)
  const ref = useCallback((el: T | null) => {
    ro.current?.disconnect()
    ro.current = null
    if (!el) return
    const obs = new ResizeObserver(([entry]) => {
      const r = entry.contentRect
      setSize((s) => (s.width === Math.round(r.width) && s.height === Math.round(r.height) ? s : { width: Math.round(r.width), height: Math.round(r.height) }))
    })
    obs.observe(el)
    ro.current = obs
  }, [])
  return [ref, size]
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && !!t.closest('input, textarea, select, [contenteditable="true"]')
const dialogOpen = () => !!document.querySelector('[role="dialog"][aria-modal="true"]')

/**
 * The video editor (Creatives v2.1). On a computer it FITS the screen: one
 * header line, the preview beside the scene list / inspector tabs, the
 * timeline under them, and the chat on the right (hidden to a slim rail at
 * will, remembered per device). From 1024 to 1279 px the chat is a drawer
 * over the right edge; below that the page stacks and the chat is a bottom
 * sheet behind a floating Chat button (view and reorder on a phone; export
 * needs a computer).
 *
 * The chat is the same agent as the workspace, in this video's session: the
 * scenes picked on the timeline or in the list are what a message is about
 * (sent as its focus), pending edits are saved before a message goes so the
 * agent sees them, and whatever the agent changes is read back at once.
 */
export default function EditorWorkspace({ videoId, meta, budget, onBudget }: EditorWorkspaceProps) {
  const navigate = useNavigate()
  const narrow = useIsMobile(768)
  const fitted = !useIsMobile(1024)
  const docked = !useIsMobile(1280)
  const now = useNow(30_000)
  const v = useCreativeVideo(videoId, onBudget)
  const library = useCreativeAudio()
  const { data: styles } = useApiData(getCreativeStyles)
  const video = v.video
  const spans = useMemo(() => (video ? sceneSpans(video.scenes) : []), [video])
  const order = useMemo(() => spans.map((s) => s.id), [spans])
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
  const [picked, setPicked] = useState<SceneSelection>(NO_SELECTION)
  const [picker, setPicker] = useState<{ replace: CreativeVideoScene | null } | null>(null)
  const [cardEditor, setCardEditor] = useState<{ scene: CreativeVideoScene | null; fields: TemplateFields | null } | null>(null)
  const [propose, setPropose] = useState<{ replace: CreativeVideoScene | null } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [reviewJobId, setReviewJobId] = useState<number | null>(null)

  /* ---------- the chat ---------- */

  const [dockOpen, setDockOpen] = useStoredFlag(CHAT_OPEN_KEY, true)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [focusNonce, setFocusNonce] = useState(0)
  const [flushing, setFlushing] = useState(false)

  const refreshVideo = v.refresh
  const agent = useCreativeAgent({
    enabled: meta.ai.configured,
    onBudget,
    videoId,
    initialMode: 'generate',
    // Whatever the agent changed in the video is read back at once.
    onMessages: (added) => {
      if (changesVideo(added)) refreshVideo()
    },
  })

  // A job of this video moved in the chat (Go, a step finished): the timeline shows it.
  const chatJobsKey = useMemo(
    () => jobsFingerprint(Object.values(agent.jobs).filter((j) => !j.video_id || j.video_id === videoId)),
    [agent.jobs, videoId],
  )
  const lastChatJobsKey = useRef<string | null>(null)
  useEffect(() => {
    if (lastChatJobsKey.current !== null && lastChatJobsKey.current !== chatJobsKey) refreshVideo()
    lastChatJobsKey.current = chatJobsKey
  }, [chatJobsKey, refreshVideo])

  const openChat = useCallback(() => {
    if (docked) setDockOpen(true)
    else setOverlayOpen(true)
  }, [docked, setDockOpen])
  const closeChat = () => {
    if (docked) setDockOpen(false)
    else setOverlayOpen(false)
  }

  const sendChat = async (text: string) => {
    if (flushing || agent.running) return
    const focus = focusIds(picked, order)
    setFlushing(true)
    // The agent must see — and not overwrite — the person's latest edits.
    await v.flush()
    setFlushing(false)
    const stored = await agent.send(text, agent.mode, { focusSceneIds: focus })
    if (!stored) setDraft((d) => (d.trim() === '' ? text : d))
  }

  /* ---------- picking scenes ---------- */

  // Scenes that left the video (removed, replaced by the agent) leave the pick.
  const orderKey = order.join(',')
  useEffect(() => {
    setPicked((p) => pruneSelection(p, order))
    // orderKey stands for order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderKey])

  const pickScene = (id: number, mods: ClickModifiers) => {
    setPicked((p) => clickSelect(p, order, id, mods))
    setTab('scenes')
  }
  const marquee = (ids: number[], additive: boolean) => {
    setPicked((p) => marqueeSelect(p, order, ids, additive))
    if (ids.length > 0) setTab('scenes')
  }
  const clearPick = () => setPicked(NO_SELECTION)
  const unfocus = (id: number) => setPicked((p) => ({ ids: p.ids.filter((x) => x !== id), anchor: p.anchor === id ? null : p.anchor }))

  const improve = (scene: CreativeVideoScene, n: number) => {
    setPicked({ ids: [scene.id], anchor: scene.id })
    // Improving a scene means a new clip: Generate (it is still priced and waits for Go).
    if (agent.mode !== 'generate') agent.setMode('generate')
    setDraft(improvePrompt(n))
    openChat()
    setFocusNonce((x) => x + 1)
  }
  const askAbout = () => {
    openChat()
    setFocusNonce((x) => x + 1)
  }

  useEffect(() => {
    if (selection?.kind === 'caption') setTab('captions')
    if (selection?.kind === 'sfx') setTab('audio')
  }, [selection])

  const onToggle = useCallback(() => {
    sound.unlock()
    play.toggle()
  }, [sound, play])

  // Space plays / pauses; Esc closes the chat overlay, else clears the pick (outside text fields and dialogs).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialogOpen()) return
      if (e.key === 'Escape') {
        if (!docked && overlayOpen) {
          setOverlayOpen(false)
          return
        }
        if (isTyping(e.target)) return
        setPicked(NO_SELECTION)
        return
      }
      if (e.code !== 'Space') return
      const t = e.target as HTMLElement | null
      if (isTyping(t) || t?.closest('button')) return
      e.preventDefault()
      onToggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onToggle, docked, overlayOpen])

  /* ---------- the fitted layout's preview size ---------- */

  const [mainRef, mainSize] = useBoxSize<HTMLDivElement>()

  // A proposed job under review closes once it is no longer waiting (started, cancelled, expired).
  const reviewJob = reviewJobId !== null ? (video?.jobs.find((j) => j.id === reviewJobId) ?? null) : null
  useEffect(() => {
    if (reviewJobId !== null && video && (!reviewJob || reviewJob.status !== 'proposed')) setReviewJobId(null)
  }, [reviewJobId, reviewJob, video])

  if (!video) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <AdminMenuButton />
          <Link to="/admin/creatives?panel=videos" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted no-underline hover:text-accent">
            <ArrowLeft size={15} aria-hidden="true" />
            Video projects
          </Link>
        </div>
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
  const styleRow = style ? styles?.find((s) => s.id === style.id) : undefined
  const defaultEngine: SceneEngine = styleRow?.default_engine ?? 'kling'
  const family: 'pixel' | 'clean' =
    styleRow?.template_family ?? (video.timeline.caption_style === 'pixel' || video.timeline.look.pixel_size > 0 ? 'pixel' : 'clean')
  const focus = focusChips(picked, video.scenes, order)

  const previewFit = fitted
    ? {
        height: `${Math.max(160, mainSize.height - PREVIEW_CHROME_PX)}px`,
        maxWidth: Math.max(180, Math.min(PREVIEW_MAX_W[video.aspect], mainSize.width - INSPECTOR_MIN_W - 12)),
      }
    : undefined

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

  // The editor's own Go / Stop: the chat's copy of the job is read again after.
  const approveJob = (j: CreativeAgentJob) => void v.approveJob(j).then(agent.refresh)
  const cancelJob = (j: CreativeAgentJob) => void v.cancelJob(j).then(agent.refresh)

  const saveState = v.saving ? (
    <span className="inline-flex items-center gap-1 text-[11.5px] text-muted">
      <LoaderCircle size={12} aria-hidden="true" className="animate-spin" />
      Saving…
    </span>
  ) : v.saveError ? (
    <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-red">
      <CircleAlert size={12} aria-hidden="true" />
      Not saved
    </span>
  ) : v.dirty ? (
    <span className="text-[11.5px] text-muted">Unsaved</span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11.5px] text-muted">
      <CircleCheck size={12} aria-hidden="true" className="text-green" />
      Saved
    </span>
  )

  const chatPanel = (placement: 'dock' | 'drawer' | 'sheet') => (
    <EditorChatPanel
      agent={agent}
      videoId={videoId}
      placement={placement}
      aiConfigured={meta.ai.configured}
      configured={meta.configured}
      retentionDays={meta.retention_days}
      budget={budget}
      now={now}
      draft={draft}
      onDraft={setDraft}
      onSend={(text) => void sendChat(text)}
      flushing={flushing}
      focus={focus}
      onUnfocus={unfocus}
      onClearFocus={clearPick}
      focusNonce={focusNonce}
      onClose={closeChat}
      onDownload={download}
      onNavigate={(path) => navigate(path)}
    />
  )

  const notices = (
    <>
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
          On a phone you can watch, reorder and check the scenes, and use the chat. Open the editor on a computer to trim precisely and export.
        </p>
      )}
      {sound.problem && (
        <p className={NOTICE.warn} role="status">
          <TriangleAlert size={15} aria-hidden="true" />
          {sound.problem}
        </p>
      )}
      {/* Jobs, one slim line each: a priced proposal (Review and Go), a running one (Stop), a finished one with failures. */}
      {openJobs.map((job) => (
        <EditorJobStrip
          key={job.id}
          job={job}
          busy={!!v.jobBusy[job.id]}
          error={v.jobErrors[job.id]}
          onCancel={cancelJob}
          onReview={(j) => setReviewJobId(j.id)}
        />
      ))}
      {recentJobs.map((job) => (
        <EditorJobStrip key={job.id} job={job} busy={false} error={undefined} onCancel={() => undefined} />
      ))}
    </>
  )

  const preview = (
    <section className={`${fitted ? PANE_TIGHT : PANE} flex-none items-center justify-center`} aria-label="Preview">
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
        fit={previewFit}
      />
      {sound.preparing && <p className="text-center text-[11px] text-faint">Preparing the sound…</p>}
    </section>
  )

  const addActions = (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        className={`${ADD_BTN} border-transparent bg-accent text-on-accent shadow-[0_6px_16px_var(--glow)] hover:brightness-[1.06]`}
        onClick={() => {
          v.clearActionError()
          setPropose({ replace: null })
        }}
        disabled={!!v.busy}
      >
        <Sparkles size={13} aria-hidden="true" />
        Add scenes with AI
      </button>
      <button type="button" className={`${ADD_BTN} border-border bg-surface text-text hover:border-accent-line hover:bg-accent-soft`} onClick={() => setPicker({ replace: null })} disabled={!!v.busy}>
        <Film size={13} aria-hidden="true" />
        From the Gallery
      </button>
      <button type="button" className={`${ADD_BTN} border-border bg-surface text-text hover:border-accent-line hover:bg-accent-soft`} onClick={() => setCardEditor({ scene: null, fields: null })} disabled={!!v.busy}>
        <LayoutTemplate size={13} aria-hidden="true" />
        Card · free
      </button>
      {v.busy && <LoaderCircle size={14} aria-hidden="true" className="animate-spin text-accent" />}
    </div>
  )

  const inspector = (
    <section
      className={`${fitted ? `${PANE_TIGHT} min-h-0 min-w-0 flex-1` : PANE}`}
      aria-label="Inspector"
    >
      <Segmented value={tab} onChange={setTab} options={TABS} ariaLabel="Inspector" size="sm" />
      <div key={tab} className={`animate-[fadeup_0.3s_ease-out] ${fitted ? 'min-h-0 flex-1 overflow-y-auto pr-0.5 [scrollbar-width:thin]' : ''}`}>
        {tab === 'scenes' && (
          <SceneInspector
            scenes={video.scenes}
            spans={spans}
            picked={picked}
            now={now}
            busy={!!v.busy}
            onPick={pickScene}
            onClearPick={clearPick}
            onImprove={improve}
            onAskAbout={askAbout}
            actions={addActions}
            onMove={v.moveScene}
            onLabel={(id, label) => v.updateScene(id, { label })}
            onTrim={(id, patch) => v.updateScene(id, patch)}
            onReplaceClip={(scene) => setPicker({ replace: scene })}
            onRegenerate={(scene) => {
              v.clearActionError()
              setPropose({ replace: scene })
            }}
            onEditCard={(scene, fields) => setCardEditor({ scene, fields })}
            onRemove={(scene) => void v.removeScene(scene.id)}
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
  )

  const timeline = (
    <section className={`${fitted ? PANE_TIGHT : PANE} flex-none`} aria-label="Timeline">
      <Timeline
        video={video}
        spans={spans}
        totalMs={total}
        timeMs={play.timeMs}
        now={now}
        selection={selection}
        onSelect={setSelection}
        picked={picked}
        onPickScene={pickScene}
        onMarquee={marquee}
        onClearPick={clearPick}
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
  )

  const running = agent.running || flushing

  return (
    <>
      <div className={fitted ? 'flex h-[calc(100dvh-44px)] min-h-[600px] min-w-0 flex-col gap-2' : 'flex min-w-0 flex-col gap-3 pb-20'}>
        <EditorHeader
          video={video}
          totalMs={total}
          locked={locked}
          onTitle={v.setTitle}
          saveState={saveState}
          onExport={() => setExporting(true)}
          narrow={narrow}
          onDelete={() => setConfirmDelete(true)}
          deleteDisabled={!!v.busy}
        />

        <div className={fitted ? 'flex min-h-0 min-w-0 flex-1 gap-3' : 'flex min-w-0 flex-col gap-3'}>
          <div className={fitted ? 'flex min-h-0 min-w-0 flex-1 flex-col gap-2' : 'flex min-w-0 flex-col gap-3'}>
            {notices}
            {fitted ? (
              <div ref={mainRef} className="flex min-h-0 min-w-0 flex-1 gap-2.5">
                {preview}
                {inspector}
              </div>
            ) : (
              <>
                {preview}
                {inspector}
              </>
            )}
            {timeline}
          </div>

          {docked &&
            (dockOpen ? (
              <div className="flex min-h-0 w-[380px] flex-none flex-col animate-[fadeup_0.3s_ease-out]">{chatPanel('dock')}</div>
            ) : (
              <button
                type="button"
                onClick={() => setDockOpen(true)}
                className="flex w-11 flex-none cursor-pointer flex-col items-center gap-2.5 rounded-card border border-border bg-surface py-3 text-muted transition-[border-color,color,background] duration-150 hover:border-accent-line hover:bg-accent-soft hover:text-accent"
                aria-label="Show the chat"
                title="Show the chat"
              >
                <PanelRightOpen size={16} aria-hidden="true" />
                <span className="text-[11px] font-bold [writing-mode:vertical-rl]">Chat</span>
                {running && <LoaderCircle size={13} aria-hidden="true" className="animate-spin text-accent" />}
              </button>
            ))}
        </div>
      </div>

      {/* Below 1280 px: a drawer (from 1024) or a bottom sheet, behind a floating Chat button. */}
      {!docked && !overlayOpen && (
        <button
          type="button"
          onClick={() => setOverlayOpen(true)}
          className="fixed bottom-4 right-4 z-[65] inline-flex h-12 cursor-pointer items-center gap-2 rounded-pill border border-accent-line bg-surface pl-4 pr-5 text-[13px] font-extrabold text-accent shadow-[0_14px_36px_rgba(0,0,0,0.35)] transition-[background] duration-150 hover:bg-accent-soft"
        >
          {running ? <LoaderCircle size={16} aria-hidden="true" className="animate-spin" /> : <MessageSquare size={16} aria-hidden="true" />}
          Chat
          {picked.ids.length > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 font-mono text-[10.5px] text-on-accent">{picked.ids.length}</span>
          )}
        </button>
      )}
      {!docked && overlayOpen && (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-label="Chat about this video">
          <button type="button" className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-[2px] animate-[fadeup_0.2s_ease-out]" onClick={() => setOverlayOpen(false)} aria-label="Close the chat" tabIndex={-1} />
          {fitted ? (
            <div className="absolute inset-y-0 right-0 flex w-[400px] max-w-[92vw] flex-col animate-[fadeup_0.25s_ease-out]">{chatPanel('drawer')}</div>
          ) : (
            <div className="absolute inset-x-0 bottom-0 flex h-[86dvh] flex-col animate-[fadeup_0.25s_ease-out]">{chatPanel('sheet')}</div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <CreativeModal open={reviewJob !== null} title="Review the job" onClose={() => setReviewJobId(null)} maxWidth={620}>
        {reviewJob && (
          <JobCard
            job={reviewJob}
            budget={budget}
            now={now}
            retentionDays={meta.retention_days}
            configured={meta.configured}
            busy={v.jobBusy[reviewJob.id]}
            error={v.jobErrors[reviewJob.id]}
            onApprove={approveJob}
            onCancel={cancelJob}
            onOpenPlan={() => navigate(`/admin/creatives?panel=plans&plan=${reviewJob.plan_id}`)}
            onOpenGallery={() => navigate('/admin/creatives?panel=gallery')}
            onDownload={download}
            hideGallery
          />
        )}
      </CreativeModal>
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
            // A priced job waits for Go: open its card right away.
            if (job) setReviewJobId(job.id)
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
    </>
  )
}
