import { useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, Film, LoaderCircle, MessageSquare, MessagesSquare, PanelRightClose, SquarePen, X } from 'lucide-react'
import ConfirmModal from '../../../ui/ConfirmModal'
import type { CreativeAgentState } from '../../../../hooks/useCreativeAgent'
import { AI_NOT_CONNECTED } from '../../../../lib/creativesAi'
import { agentErrorMessage, jobsFingerprint } from '../../../../lib/creativesAgent'
import type { FocusChip } from '../../../../lib/videoEditor/selection'
import type { CreativeBudget, CreativeGeneration } from '../../../../types/creatives'
import { ModeSwitch } from '../agent/AgentTopBar'
import ChatComposer from '../agent/chat/ChatComposer'
import { ChatNotice } from '../agent/chat/ChatParts'
import ChatTranscript from '../agent/chat/ChatTranscript'
import TeamChatsModal from '../agent/chat/TeamChatsModal'

export type ChatPlacement = 'dock' | 'drawer' | 'sheet'

interface EditorChatPanelProps {
  agent: CreativeAgentState
  videoId: number
  placement: ChatPlacement
  /** Claude is connected on this server. */
  aiConfigured: boolean
  /** Higgsfield is connected (a job can start). */
  configured: boolean
  retentionDays: number
  budget: CreativeBudget
  now: number
  draft: string
  onDraft: (text: string) => void
  /** Send (the editor saves its pending edits first and adds the focus). */
  onSend: (text: string) => void
  /** Saving the editor's edits before a message goes. */
  flushing: boolean
  focus: { chips: FocusChip[]; more: number }
  onUnfocus: (sceneId: number) => void
  onClearFocus: () => void
  /** Bumped by "Improve with AI": the box gets the cursor, at the end of the prefill. */
  focusNonce: number
  onClose: () => void
  onDownload: (generation: CreativeGeneration, index: number) => Promise<string | null>
  onNavigate: (path: string) => void
}

/** Within this many pixels of the bottom, new messages keep the transcript scrolled to the end. */
const STICK_PX = 160

const HEAD_BTN =
  'inline-flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-[8px] border border-transparent bg-transparent text-muted transition-[border-color,background,color] duration-150 hover:border-border hover:bg-surface2 hover:text-text disabled:cursor-not-allowed disabled:opacity-40'
const FOCUS_PILL =
  'inline-flex h-6 max-w-full items-center gap-1 rounded-pill border px-2 text-[11px] font-semibold leading-none'

/** Short, editor-shaped starters; they go in the current mode. */
const STARTERS = [
  'Show me a storyboard for this video first',
  'Make the hook stronger',
  'Is the length right for the platform?',
]

/** What the next message is about: the picked scenes as chips, or the whole video. */
function FocusLine({
  focus,
  onUnfocus,
  onClear,
}: {
  focus: { chips: FocusChip[]; more: number }
  onUnfocus: (id: number) => void
  onClear: () => void
}) {
  if (focus.chips.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-faint">
        <Film size={12} aria-hidden="true" />
        Whole video
        <span className="font-normal">· click a clip to target it</span>
      </p>
    )
  }
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5" aria-label="This message is about">
      <Crosshair size={12} aria-hidden="true" className="flex-none text-accent" />
      {focus.chips.map((c) => (
        <span key={c.id} className={`${FOCUS_PILL} border-accent-line bg-accent-soft text-accent`}>
          <span className="min-w-0 truncate">
            Scene {c.n}
            {c.label ? ` · ${c.label}` : ''}
          </span>
          <button
            type="button"
            onClick={() => onUnfocus(c.id)}
            aria-label={`Stop targeting scene ${c.n}`}
            className="-mr-1 inline-flex h-5 w-5 flex-none cursor-pointer items-center justify-center rounded-full bg-transparent text-accent hover:bg-surface"
          >
            <X size={11} aria-hidden="true" />
          </button>
        </span>
      ))}
      {focus.more > 0 && <span className={`${FOCUS_PILL} border-border bg-surface2 text-muted`}>+{focus.more} more</span>}
      <button type="button" onClick={onClear} className="cursor-pointer bg-transparent text-[11px] font-semibold text-muted underline-offset-2 hover:text-accent hover:underline">
        All scenes
      </button>
    </div>
  )
}

/**
 * The editor's chat (Creatives v2.1): the same agent as the workspace, in
 * this video's own session — it sees the video, and the scenes picked on
 * the timeline ("this" = them). It can show a storyboard, propose a priced
 * job to regenerate a scene (Go is still on the job card), or make free
 * edits (lengths, order, captions, music) straight away. Docked on a wide
 * screen, a drawer or a bottom sheet on a smaller one.
 */
export default function EditorChatPanel({
  agent,
  videoId,
  placement,
  aiConfigured,
  configured,
  retentionDays,
  budget,
  now,
  draft,
  onDraft,
  onSend,
  flushing,
  focus,
  onUnfocus,
  onClearFocus,
  focusNonce,
  onClose,
  onDownload,
  onNavigate,
}: EditorChatPanelProps) {
  const [confirmNew, setConfirmNew] = useState(false)
  const [chatsOpen, setChatsOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const firstScroll = useRef(true)

  const jobsKey = useMemo(() => jobsFingerprint(Object.values(agent.jobs)), [agent.jobs])
  const scrollKey = `${agent.messages.length}|${agent.pending ? 1 : 0}|${agent.running ? 1 : 0}|${agent.notices.length}|${jobsKey}`

  useEffect(() => {
    const el = scrollRef.current
    if (!el || agent.status !== 'ready') return
    if (!firstScroll.current && !stick.current) return
    const instant = firstScroll.current
    firstScroll.current = false
    const id = requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: instant ? 'auto' : 'smooth' }))
    return () => cancelAnimationFrame(id)
  }, [scrollKey, agent.status])

  const onScroll = () => {
    const el = scrollRef.current
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX
  }

  const send = (text: string) => {
    stick.current = true
    onSend(text)
  }

  const canSend = aiConfigured && agent.status === 'ready'
  const empty = agent.messages.length === 0 && !agent.pending && !agent.running
  const busy = agent.running || flushing

  let body
  if (agent.status === 'loading') {
    body = (
      <div className="flex flex-col items-center gap-2.5 py-16 text-[12.5px] text-muted" role="status">
        <LoaderCircle size={20} aria-hidden="true" className="animate-spin text-accent" />
        Opening this video’s chat…
      </div>
    )
  } else if (agent.status === 'error' && aiConfigured) {
    body = (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-[13px] leading-[1.55] text-text">{agentErrorMessage(agent.loadError, { kind: 'turn' }, 'Could not open the chat.')}</p>
        <button
          type="button"
          onClick={agent.reload}
          className="cursor-pointer rounded-pill border border-border bg-surface2 px-4 py-2 text-[12.5px] font-semibold text-text hover:border-accent"
        >
          Try again
        </button>
      </div>
    )
  } else if (empty) {
    body = (
      <div className="flex flex-col gap-3 py-2">
        <p className="text-[13px] leading-[1.6] text-muted">
          Ask about this video or say what to change. Click a clip on the timeline to target it, or drag across several. It shows a storyboard before it builds, and nothing is spent until you press Go.
        </p>
        <div className="flex flex-col gap-1.5">
          {STARTERS.map((t) => (
            <button
              key={t}
              type="button"
              disabled={!canSend || busy}
              onClick={() => send(t)}
              className="flex min-h-9 cursor-pointer items-center rounded-field border border-border bg-surface2/60 px-3 text-left text-[12.5px] font-semibold text-text transition-[border-color,background] duration-150 hover:border-accent-line hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t}
            </button>
          ))}
        </div>
        {!aiConfigured && <ChatNotice tone="warn" text={`${AI_NOT_CONNECTED}, so the chat can’t answer here. The editor still works.`} />}
      </div>
    )
  } else {
    body = (
      <ChatTranscript
        startedBy={agent.startedBy}
        answering={agent.answering}
        messages={agent.messages}
        jobs={agent.jobs}
        notices={agent.notices}
        pending={agent.pending}
        running={agent.running}
        stopping={agent.stopping}
        progress={agent.progress}
        elapsed={agent.elapsed}
        budget={budget}
        now={now}
        retentionDays={retentionDays}
        configured={configured}
        jobBusy={agent.jobBusy}
        jobErrors={agent.jobErrors}
        onApprove={(job) => void agent.approve(job)}
        onCancel={(job) => void agent.cancel(job)}
        onOpenPlan={(planId) => onNavigate(`/admin/creatives?panel=plans&plan=${planId}`)}
        onOpenGallery={() => onNavigate('/admin/creatives?panel=gallery')}
        onDownload={(_jobId, g, i) => onDownload(g, i)}
        onCarryOn={agent.carryOn}
        onChoose={(value) => send(value)}
        onOpenEditor={onNavigate}
        currentVideoId={videoId}
      />
    )
  }

  const shell =
    placement === 'dock'
      ? 'h-full rounded-card border border-border'
      : placement === 'drawer'
        ? 'h-full border-l border-border shadow-[-24px_0_60px_rgba(0,0,0,0.35)]'
        : 'h-full rounded-t-[20px] border-t border-border shadow-[0_-24px_60px_rgba(0,0,0,0.35)]'

  return (
    <section className={`relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-surface ${shell}`} aria-label="Chat about this video">
      <header className="flex flex-none items-center gap-1.5 border-b border-hair px-2.5 py-2">
        <MessageSquare size={15} aria-hidden="true" className="ml-1 flex-none text-accent" />
        <h2 className="min-w-0 flex-1 truncate font-display text-[14px] font-extrabold text-text">Chat</h2>
        <ModeSwitch mode={agent.mode} onMode={agent.setMode} locked={busy} size="sm" />
        <button type="button" className={HEAD_BTN} onClick={() => setChatsOpen(true)} disabled={busy || agent.startingNew} aria-label="This video's chats" title="This video's chats: the whole team shares them">
          <MessagesSquare size={15} aria-hidden="true" />
        </button>
        <button type="button" className={HEAD_BTN} onClick={() => setConfirmNew(true)} disabled={busy || agent.startingNew || agent.status === 'loading'} aria-label="New chat" title="Start a new chat about this video">
          <SquarePen size={15} aria-hidden="true" />
        </button>
        <button type="button" className={HEAD_BTN} onClick={onClose} aria-label={placement === 'dock' ? 'Hide the chat' : 'Close the chat'} title={placement === 'dock' ? 'Hide the chat' : 'Close'}>
          {placement === 'dock' ? <PanelRightClose size={15} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
        </button>
      </header>

      {agent.freshChatNotice && (
        <div className="flex-none px-3 pt-3">
          <ChatNotice tone="info" text={agent.freshChatNotice} onDismiss={agent.dismissFreshChatNotice} />
        </div>
      )}

      <div ref={scrollRef} onScroll={onScroll} className="@container relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 [scrollbar-width:thin]">
        {body}
      </div>

      <ChatComposer
        variant="panel"
        value={draft}
        onChange={onDraft}
        onSend={() => {
          const text = draft.trim()
          if (!text || busy) return
          onDraft('')
          send(text)
        }}
        onStop={agent.stop}
        mode={agent.mode}
        running={busy}
        stopping={agent.stopping}
        disabled={!canSend}
        disabledPlaceholder={!aiConfigured ? 'The chat is off on this server' : agent.status === 'loading' ? 'Opening the chat…' : 'The chat could not be opened'}
        lastCost={agent.lastCost}
        above={<FocusLine focus={focus} onUnfocus={onUnfocus} onClear={onClearFocus} />}
        focusNonce={focusNonce}
        placeholder={agent.mode === 'generate' ? 'Say what to change…' : 'Ask about this video…'}
      />

      <ConfirmModal
        open={confirmNew}
        title="Start a new chat about this video?"
        message="The whole team moves to the new chat about this video. The current one stays in this video’s chats for 7 days; the video, memory, brief and plans stay, and a running job keeps going."
        confirmLabel="New chat"
        cancelLabel="Keep this one"
        onConfirm={() => {
          setConfirmNew(false)
          firstScroll.current = true
          void agent.newChat().then((ok) => ok && onDraft(''))
        }}
        onCancel={() => setConfirmNew(false)}
      />

      <TeamChatsModal
        open={chatsOpen}
        onClose={() => setChatsOpen(false)}
        currentId={agent.sessionId}
        videoId={videoId}
        onOpen={(id) => {
          setChatsOpen(false)
          if (id === agent.sessionId) return
          firstScroll.current = true
          void agent.openSession(id).then((ok) => ok && onDraft(''))
        }}
      />
    </section>
  )
}
