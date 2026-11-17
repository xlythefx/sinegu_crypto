import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ConfirmModal from '../../../ui/ConfirmModal'
import { useCreativeAgent } from '../../../../hooks/useCreativeAgent'
import { useCreativesPanel } from '../../../../hooks/useCreativesPanel'
import { useIsMobile } from '../../../../hooks/useIsMobile'
import { useNow } from '../../../../hooks/useNow'
import { creativeErrorMessage, DOWNLOAD_FRESH_MS, startSignedDownload } from '../../../../lib/creatives'
import { AI_NOT_CONNECTED } from '../../../../lib/creativesAi'
import {
  agentErrorMessage,
  jobsFingerprint,
  type AgentStarter,
  type CreativesDocPanel,
  type CreativesPanelKey,
} from '../../../../lib/creativesAgent'
import { getCreativeGeneration } from '../../../../services/creatives'
import type {
  CreativeAiMeta,
  CreativeBudget,
  CreativeGeneration,
  CreativesMeta,
} from '../../../../types/creatives'
import AgentTopBar from './AgentTopBar'
import ChatComposer from './chat/ChatComposer'
import ChatEmptyState from './chat/ChatEmptyState'
import { ChatNotice } from './chat/ChatParts'
import ChatTranscript from './chat/ChatTranscript'
import TeamChatsModal from './chat/TeamChatsModal'
import WorkspacePanel from './panels/WorkspacePanel'

interface CreativesWorkspaceProps {
  meta: CreativesMeta
  budget: CreativeBudget
  onBudget: (budget: CreativeBudget) => void
  ai: CreativeAiMeta
  onAi: (ai: CreativeAiMeta) => void
}

type PanelTarget = { panel: CreativesPanelKey | null; extra?: { plan?: number; make?: boolean } }

/** A starter that needs Generate waits this long after the switch flips, so it is seen. */
const STARTER_SWITCH_MS = 450
/** Within this many pixels of the bottom, new messages keep the chat scrolled to the end. */
const STICK_PX = 220

const atBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - STICK_PX

/**
 * Admin → Creatives as a chat-first workspace ("like Claude Design"): one
 * calm, centred conversation with the agent most of the time, and the
 * panels — Plans, Gallery, Pixel, Brief, Memory, Budget — out of the way
 * until toggled. From 1280px a panel sits beside the chat; below it is a
 * sheet over it (full screen on a phone). The open panel lives in `?panel=`.
 *
 * Ask mode talks it through and never spends. Generate mode may propose a
 * priced job, which only starts on its card's Go.
 */
export default function CreativesWorkspace({ meta, budget, onBudget, ai, onAi }: CreativesWorkspaceProps) {
  const panels = useCreativesPanel()
  const docked = !useIsMobile(1280)
  const agent = useCreativeAgent({ enabled: ai.configured, onBudget })
  const now = useNow(30_000)
  const [draft, setDraft] = useState('')
  const [confirmNew, setConfirmNew] = useState(false)
  const [chatsOpen, setChatsOpen] = useState(false)
  const [dirtyDocs, setDirtyDocs] = useState<Record<CreativesDocPanel, boolean>>({ brief: false, playbook: false })
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState<PanelTarget | null>(null)
  const [starting, setStarting] = useState(false)
  const starterTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(starterTimer.current), [])

  /* ---------- panels (unsaved brief / playbook edits are asked about first) ---------- */

  const openDoc: CreativesDocPanel | null =
    panels.panel === 'brief' || panels.panel === 'playbook' ? panels.panel : null
  const goTo = useCallback(
    (target: PanelTarget) => {
      if (openDoc && dirtyDocs[openDoc] && target.panel !== openDoc) {
        setLeaving(target)
        return
      }
      if (target.panel === null) panels.close()
      else panels.open(target.panel, target.extra)
    },
    [dirtyDocs, openDoc, panels],
  )
  const openPanel = useCallback(
    (panel: CreativesPanelKey, extra?: PanelTarget['extra']) => goTo({ panel, extra }),
    [goTo],
  )
  const togglePanel = (key: CreativesPanelKey) => goTo({ panel: panels.panel === key ? null : key })
  const onDocDirty = useCallback(
    (doc: CreativesDocPanel, dirty: boolean) => setDirtyDocs((d) => (d[doc] === dirty ? d : { ...d, [doc]: dirty })),
    [],
  )

  /* ---------- keeping the newest message in view ---------- */

  const stick = useRef(true)
  useEffect(() => {
    const onScroll = () => {
      stick.current = atBottom()
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const jobsKey = useMemo(() => jobsFingerprint(Object.values(agent.jobs)), [agent.jobs])
  const scrollKey = `${agent.messages.length}|${agent.pending ? 1 : 0}|${agent.running ? 1 : 0}|${agent.notices.length}|${jobsKey}`
  const firstScroll = useRef(true)
  const hasContent = agent.messages.length > 0 || agent.pending !== null
  useEffect(() => {
    // An empty chat stays where it is: the page title is above it.
    if (agent.status !== 'ready' || !hasContent) return
    const instant = firstScroll.current
    if (!instant && !stick.current) return
    firstScroll.current = false
    const id = requestAnimationFrame(() =>
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: instant ? 'auto' : 'smooth' }),
    )
    return () => cancelAnimationFrame(id)
  }, [scrollKey, agent.status, hasContent])

  /* ---------- sending ---------- */

  const sendText = async (text: string, mode = agent.mode) => {
    stick.current = true
    const stored = await agent.send(text, mode)
    // Not kept by the server: the words go back in the box (unless something new was typed).
    if (!stored) setDraft((d) => (d.trim() === '' ? text : d))
  }

  const onSend = () => {
    const text = draft.trim()
    if (!text || agent.running) return
    setDraft('')
    void sendText(text)
  }

  const onStarter = (s: AgentStarter) => {
    if (agent.running || starting) return
    if (s.mode === agent.mode) {
      void sendText(s.text, s.mode)
      return
    }
    // Generate starters flip the switch first, where everyone can see it.
    agent.setMode(s.mode)
    setStarting(true)
    window.clearTimeout(starterTimer.current)
    starterTimer.current = window.setTimeout(() => {
      setStarting(false)
      void sendText(s.text, s.mode)
    }, STARTER_SWITCH_MS)
  }

  /** Stop: no further steps — or, while a starter waits for its mode switch, it is not sent at all. */
  const onStop = () => {
    if (starting) {
      window.clearTimeout(starterTimer.current)
      setStarting(false)
      return
    }
    agent.stop()
  }

  const startNewChat = async () => {
    setConfirmNew(false)
    if (await agent.newChat()) {
      setDraft('')
      firstScroll.current = true
      // A fresh chat starts at its greeting, not wherever the last one was scrolled to.
      window.scrollTo({ top: 0 })
    }
  }

  /** A job step's download, through a signed path no older than its 30 minutes. */
  const download = async (jobId: number, g: CreativeGeneration, index: number): Promise<string | null> => {
    try {
      let path: string | null = g.outputs[index]?.download_path ?? null
      if (!path || Date.now() - agent.jobReadAt(jobId) > DOWNLOAD_FRESH_MS) {
        const fresh = await getCreativeGeneration(g.id)
        path = fresh?.outputs[index]?.download_path ?? null
      }
      if (!path) return `Higgsfield has deleted this file — results are only kept for ${meta.retention_days} days.`
      startSignedDownload(path)
      return null
    } catch (err) {
      return creativeErrorMessage(err, 'Could not start the download.')
    }
  }

  /* ---------- what the chat shows ---------- */

  const jobsList = Object.values(agent.jobs)
  const proposedOpen = jobsList.some((j) => j.status === 'proposed')
  const runningOpen = jobsList.some((j) => j.status === 'running')
  const newChatMessage = [
    'The current chat stays in Chats for 7 days, so you or a teammate can go back to it. Memory, brief and plans stay.',
    proposedOpen ? 'A job still waiting for its Go stays in that chat.' : '',
    runningOpen ? 'A job that is running keeps going — its results land in the Gallery.' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const empty = agent.messages.length === 0 && !agent.pending && !agent.running
  const canSend = ai.configured && agent.status === 'ready'

  let body
  if (agent.status === 'loading') {
    body = (
      <div className="flex flex-col items-center gap-3 py-24 text-[13px] text-muted" role="status">
        <LoaderCircle size={22} aria-hidden="true" className="animate-spin text-accent" />
        Opening your chat…
      </div>
    )
  } else if (agent.status === 'error' && ai.configured) {
    body = (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="max-w-[440px] text-[14px] leading-[1.6] text-text">
          {agentErrorMessage(agent.loadError, { kind: 'turn' }, 'Could not open the chat.')}
        </p>
        <button
          type="button"
          onClick={agent.reload}
          className="cursor-pointer rounded-pill border border-border bg-surface2 px-5 py-[9px] text-[13px] font-semibold text-text hover:border-accent"
        >
          Try again
        </button>
      </div>
    )
  } else if (empty || agent.status === 'error') {
    body = <ChatEmptyState enabled={canSend} busy={starting || agent.running} onStart={onStarter} />
  } else {
    body = (
      <>
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
          retentionDays={meta.retention_days}
          configured={meta.configured}
          jobBusy={agent.jobBusy}
          jobErrors={agent.jobErrors}
          onApprove={(job) => void agent.approve(job)}
          onCancel={(job) => void agent.cancel(job)}
          onOpenPlan={(planId) => openPanel('plans', { plan: planId })}
          onOpenGallery={() => openPanel('gallery')}
          onDownload={download}
          onCarryOn={agent.carryOn}
          onChoose={(value) => void sendText(value)}
          onOpenEditor={(path) => navigate(path)}
        />
        {!ai.configured && (
          <div className="mt-5">
            <ChatNotice
              tone="warn"
              text={`${AI_NOT_CONNECTED}, so the agent can’t answer here. The panels still work.`}
            />
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <div className="flex min-h-[calc(100dvh-104px)] items-start gap-5">
        <div className="flex min-w-0 flex-1 flex-col self-stretch">
          <AgentTopBar
            mode={agent.mode}
            onMode={agent.setMode}
            modeLocked={agent.running || starting}
            budget={budget}
            panel={panels.panel}
            onTogglePanel={togglePanel}
            onNewChat={() => setConfirmNew(true)}
            newChatDisabled={agent.running || agent.startingNew || agent.status === 'loading'}
            higgsfield={meta.configured}
            onChats={() => setChatsOpen(true)}
          />

          <div className="@container mx-auto w-full max-w-[760px] flex-1 pb-4 pt-4">
            {agent.freshChatNotice && (
              <div className="mb-5">
                <ChatNotice tone="info" text={agent.freshChatNotice} onDismiss={agent.dismissFreshChatNotice} />
              </div>
            )}
            {body}
          </div>

          <ChatComposer
            value={draft}
            onChange={setDraft}
            onSend={onSend}
            onStop={onStop}
            mode={agent.mode}
            running={agent.running || starting}
            stopping={agent.stopping}
            disabled={!canSend}
            disabledPlaceholder={
              !ai.configured
                ? 'The agent is off on this server'
                : agent.status === 'loading'
                  ? 'Opening your chat…'
                  : 'The chat could not be opened'
            }
            lastCost={agent.lastCost}
          />
        </div>

        {panels.panel && docked && !panels.wide && (
          <WorkspacePanel
            panel={panels.panel}
            placement="docked"
            wide={false}
            onWide={panels.setWide}
            onClose={() => goTo({ panel: null })}
            onOpen={openPanel}
            meta={meta}
            budget={budget}
            onBudget={onBudget}
            ai={ai}
            onAi={onAi}
            planId={panels.planId}
            onPlanHandled={panels.clearPlan}
            makeOpen={panels.makeOpen}
            signals={agent.signals}
            onDocDirty={onDocDirty}
            sessionId={agent.sessionId}
          />
        )}
      </div>

      {panels.panel && (!docked || panels.wide) && (
        <WorkspacePanel
          panel={panels.panel}
          placement="sheet"
          wide={panels.wide}
          onWide={panels.setWide}
          onClose={() => goTo({ panel: null })}
          onOpen={openPanel}
          meta={meta}
          budget={budget}
          onBudget={onBudget}
          ai={ai}
          onAi={onAi}
          planId={panels.planId}
          onPlanHandled={panels.clearPlan}
          makeOpen={panels.makeOpen}
          signals={agent.signals}
          onDocDirty={onDocDirty}
          sessionId={agent.sessionId}
        />
      )}

      <TeamChatsModal
        open={chatsOpen}
        onClose={() => setChatsOpen(false)}
        currentId={agent.sessionId}
        onOpen={(id) => {
          setChatsOpen(false)
          if (id === agent.sessionId) return
          void agent.openSession(id).then((ok) => {
            if (!ok) return
            setDraft('')
            firstScroll.current = true
          })
        }}
      />

      <ConfirmModal
        open={confirmNew}
        title="Start a new chat?"
        message={newChatMessage}
        confirmLabel="New chat"
        cancelLabel="Keep this one"
        onConfirm={() => void startNewChat()}
        onCancel={() => setConfirmNew(false)}
      />

      <ConfirmModal
        open={leaving !== null}
        title={`Leave the ${openDoc ?? 'brief'} without saving?`}
        message={`Your changes to the ${openDoc ?? 'brief'} are not saved yet. Leave now and they are lost.`}
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        danger
        onConfirm={() => {
          const target = leaving
          setLeaving(null)
          if (openDoc) onDocDirty(openDoc, false)
          if (!target) return
          if (target.panel === null) panels.close()
          else panels.open(target.panel, target.extra)
        }}
        onCancel={() => setLeaving(null)}
      />
    </>
  )
}
