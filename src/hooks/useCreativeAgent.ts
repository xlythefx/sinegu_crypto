import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useInterval } from './useInterval'
import { usePoll } from './usePoll'
import { ApiError } from '../services/api'
import { errorBudget } from '../lib/creatives'
import {
  agentErrorMessage,
  CLIENT_MAX_STEPS,
  hasRunningJob,
  jobsById,
  jobsFingerprint,
  lastMessageId,
  latestActivityLabel,
  mergeJobs,
  mergeMessages,
  touchedPanels,
} from '../lib/creativesAgent'
import {
  agentTurn,
  approveAgentJob,
  cancelAgentJob,
  createAgentSession,
  getAgentSession,
} from '../services/creativesAgent'
import type {
  CreativeAgentJob,
  CreativeAgentMessage,
  CreativeAgentMode,
  CreativeAgentSessionState,
  CreativeAgentTurnInput,
  CreativeBudget,
} from '../types/creatives'

/** How often the chat re-reads itself while a job is generating (visible tab only). */
const POLL_MS = 5000

/**
 * A line the CLIENT adds to the chat (a failed send, "Stopped"). Never stored:
 * it sits after the server message it was raised beside, and is gone on New chat.
 */
export interface AgentNotice {
  key: string
  /** Rendered after the message with this id (0 = before every message). */
  afterId: number
  text: string
  tone: 'error' | 'info'
  /** "Carry on": ask for the next step of an answer that was stopped. */
  canContinue?: boolean
}

/** The message just sent, shown at once while the first step runs. */
export interface PendingMessage {
  text: string
  mode: CreativeAgentMode
}

export type AgentJobAction = 'approve' | 'cancel'

export interface CreativeAgentState {
  /** 'loading' until the session is read; 'error' when it could not be. */
  status: 'loading' | 'ready' | 'error'
  loadError: unknown
  reload: () => void
  mode: CreativeAgentMode
  setMode: (mode: CreativeAgentMode) => void
  messages: CreativeAgentMessage[]
  jobs: Record<number, CreativeAgentJob>
  notices: AgentNotice[]
  pending: PendingMessage | null
  /** A turn is running (steps are being requested). */
  running: boolean
  /** Stop was pressed; the step in flight still lands. */
  stopping: boolean
  /** The latest activity label of this answer ("Read the planner"), or null while it is thinking. */
  progress: string | null
  /** Whole seconds since the message was sent (0 when idle). */
  elapsed: number
  /** What the last answer cost in Claude calls, all its steps together; null before the first. */
  lastCost: number | null
  /** Send a message. Resolves false when it was NOT stored (the composer gets the text back). */
  send: (text: string, mode?: CreativeAgentMode) => Promise<boolean>
  /** Ask for the next step of an answer that was stopped. */
  carryOn: () => void
  stop: () => void
  newChat: () => Promise<boolean>
  startingNew: boolean
  approve: (job: CreativeAgentJob) => Promise<void>
  cancel: (job: CreativeAgentJob) => Promise<void>
  /** Per job: an action in flight. */
  jobBusy: Record<number, AgentJobAction | undefined>
  /** Per job: the last action's error sentence, shown on its card. */
  jobErrors: Record<number, string | undefined>
  /** When this job was last read (its download paths are valid 30 min from then). */
  jobReadAt: (jobId: number) => number
  /** Go up when an answer changed plans / memory, or a job made something new — open panels re-read. */
  signals: { plans: number; memory: number; gallery: number }
}

interface Options {
  /** Claude is connected on this server (`ai.configured`). Off = nothing is ever sent. */
  enabled: boolean
  /** Every answer carries the month's budget — hand it to the page. */
  onBudget: (budget: CreativeBudget) => void
}

/**
 * The Creatives chat agent, CLIENT-STEPPED: one request is at most one model
 * call (Cloudflare cuts a request at 100 s), so a message is sent with its
 * text and the hook keeps calling `/agent/turn` without text while the answer
 * says `continue`. It stops on done / awaiting_approval / error, after Stop,
 * or after CLIENT_MAX_STEPS as a backstop. A ref guard means a double Enter
 * can never send twice. While any job is running the session is re-read
 * every 5 s, only while the tab is visible — that read is also what moves a
 * job on to its next step.
 *
 * On a failed step the session is read again before anything is said, so the
 * chat shows exactly what the server kept — and a message that was never
 * stored goes back into the composer instead of being lost.
 */
export function useCreativeAgent({ enabled, onBudget }: Options): CreativeAgentState {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadError, setLoadError] = useState<unknown>(null)
  const [mode, setModeState] = useState<CreativeAgentMode>('ask')
  const [messages, setMessages] = useState<CreativeAgentMessage[]>([])
  const [jobs, setJobs] = useState<Record<number, CreativeAgentJob>>({})
  const [notices, setNotices] = useState<AgentNotice[]>([])
  const [pending, setPending] = useState<PendingMessage | null>(null)
  const [running, setRunning] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [lastCost, setLastCost] = useState<number | null>(null)
  const [startingNew, setStartingNew] = useState(false)
  const [jobBusy, setJobBusy] = useState<Record<number, AgentJobAction | undefined>>({})
  const [jobErrors, setJobErrors] = useState<Record<number, string | undefined>>({})
  const [signals, setSignals] = useState({ plans: 0, memory: 0, gallery: 0 })
  const [tick, setTick] = useState(0)

  const mounted = useRef(true)
  const busy = useRef(false)
  const stopRef = useRef(false)
  const polling = useRef(false)
  const sessionRef = useRef<string | null>(null)
  const messagesRef = useRef<CreativeAgentMessage[]>([])
  const pendingRef = useRef<PendingMessage | null>(null)
  const jobBusyRef = useRef(new Set<number>())
  const readAt = useRef(new Map<number, number>())
  const noticeSeq = useRef(0)
  const startedAt = useRef(0)
  const budgetRef = useRef(onBudget)
  budgetRef.current = onBudget

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const putPending = useCallback((p: PendingMessage | null) => {
    pendingRef.current = p
    setPending(p)
  }, [])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), running ? 1000 : null)

  const stampJobs = (list: CreativeAgentJob[]) => {
    const t = Date.now()
    for (const j of list) readAt.current.set(j.id, t)
  }

  const bump = useCallback((which: { plans?: boolean; memory?: boolean; gallery?: boolean }) => {
    if (!which.plans && !which.memory && !which.gallery) return
    setSignals((s) => ({
      plans: s.plans + (which.plans ? 1 : 0),
      memory: s.memory + (which.memory ? 1 : 0),
      gallery: s.gallery + (which.gallery ? 1 : 0),
    }))
  }, [])

  /** Server truth replaces what is on screen (a full session read). */
  const replaceWith = useCallback((state: CreativeAgentSessionState) => {
    sessionRef.current = state.session.id
    messagesRef.current = state.messages
    setMessages(state.messages)
    stampJobs(state.jobs)
    setJobs(jobsById(state.jobs))
    pendingRef.current = null
    setPending(null)
    if (state.budget) budgetRef.current(state.budget)
  }, [])

  // The session: the caller's newest under 7 days, or a new one.
  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setLoadError(null)
    getAgentSession(sessionRef.current ?? undefined)
      .then((state) => {
        if (cancelled) return
        replaceWith(state)
        setModeState(state.session.mode === 'generate' ? 'generate' : 'ask')
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err)
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [tick, replaceWith])

  const reload = useCallback(() => setTick((t) => t + 1), [])

  const addNotice = useCallback((text: string, tone: AgentNotice['tone'], canContinue = false) => {
    noticeSeq.current += 1
    const notice: AgentNotice = {
      key: `n${noticeSeq.current}`,
      afterId: lastMessageId(messagesRef.current),
      text,
      tone,
      canContinue,
    }
    // Only the newest "Carry on" stays live; an older one would continue the wrong answer.
    setNotices((prev) => [...prev.map((n) => (canContinue ? { ...n, canContinue: false } : n)), notice])
  }, [])

  /**
   * New messages and changed jobs, merged in (a turn, or a poll that sends
   * the whole session). Messages are append-only, so only ids not on screen
   * yet count — a poll must not make the open panels re-read every 5 s.
   */
  const absorb = useCallback(
    (incoming: CreativeAgentMessage[], changedJobs: CreativeAgentJob[]) => {
      const seen = new Set(messagesRef.current.map((m) => m.id))
      const added = incoming.filter((m) => !seen.has(m.id))
      if (added.length > 0) {
        const merged = mergeMessages(messagesRef.current, added)
        messagesRef.current = merged
        setMessages(merged)
        // The stored copy of the message being sent has arrived: drop the stand-in.
        const p = pendingRef.current
        if (p && added.some((m) => m.kind === 'user' && m.text === p.text)) putPending(null)
        bump(touchedPanels(added))
      }
      if (changedJobs.length > 0) {
        stampJobs(changedJobs)
        setJobs((prev) => mergeJobs(prev, changedJobs))
      }
    },
    [bump, putPending],
  )

  /** Quiet re-read after a failure; resolves to the fresh state, or null when that failed too. */
  const reconcile = useCallback(async (): Promise<CreativeAgentSessionState | null> => {
    const id = sessionRef.current
    if (!id) return null
    try {
      const state = await getAgentSession(id)
      if (!mounted.current || sessionRef.current !== id) return null
      replaceWith(state)
      return state
    } catch {
      return null
    }
  }, [replaceWith])

  const runTurn = useCallback(
    async (first: CreativeAgentTurnInput): Promise<boolean> => {
      const sentText = first.text ?? null
      const beforeId = lastMessageId(messagesRef.current)
      let input = first
      let steps = 0
      let total = 0
      let stored = sentText === null
      let answered = false
      startedAt.current = Date.now()
      setElapsed(0)
      setRunning(true)
      setProgress(null)
      try {
        for (;;) {
          let res
          try {
            res = await agentTurn(input)
          } catch (err) {
            const b = errorBudget(err)
            if (b) budgetRef.current(b)
            if (!mounted.current) return stored
            // Say it only once the chat shows what the server actually kept.
            const fresh = await reconcile()
            if (sentText !== null && !stored) {
              stored = Boolean(
                fresh?.messages.some((m) => m.id > beforeId && m.kind === 'user' && m.text === sentText),
              )
              if (!fresh) putPending(null)
            }
            const msg = agentErrorMessage(err, { kind: 'turn' }, 'The agent could not answer just now.')
            addNotice(
              sentText !== null && !stored ? `${msg} Your message is back in the box below.` : msg,
              'error',
            )
            return stored
          }
          if (!mounted.current || sessionRef.current !== input.session_id) return true
          stored = true
          answered = true
          total += res.cost_usd
          if (res.budget) budgetRef.current(res.budget)
          absorb(res.messages, res.jobs)
          const label = latestActivityLabel(res.messages)
          if (label) setProgress(label)
          if (res.status === 'error') {
            if (!res.messages.some((m) => m.kind === 'notice')) {
              addNotice('Something went wrong on the agent’s side, so it stopped here. Try again.', 'error')
            }
            break
          }
          if (res.status !== 'continue') break
          if (stopRef.current) {
            addNotice('Stopped. The agent won’t take any more steps on this message.', 'info', true)
            break
          }
          steps += 1
          if (steps >= CLIENT_MAX_STEPS) {
            addNotice('The agent has taken a lot of steps on this one, so it paused here.', 'info', true)
            break
          }
          input = { session_id: input.session_id, mode: input.mode }
        }
        // A stand-in the server never echoed is replaced by the server's copy.
        if (pendingRef.current) void reconcile()
        return true
      } finally {
        if (mounted.current) {
          if (answered) setLastCost(total)
          setRunning(false)
          setStopping(false)
          setProgress(null)
        }
        stopRef.current = false
        busy.current = false
      }
    },
    [absorb, addNotice, reconcile, putPending],
  )

  const send = useCallback(
    async (text: string, asMode?: CreativeAgentMode): Promise<boolean> => {
      const clean = text.trim()
      const id = sessionRef.current
      if (!enabled || !id || clean === '' || busy.current) return false
      busy.current = true
      stopRef.current = false
      const m = asMode ?? mode
      putPending({ text: clean, mode: m })
      return runTurn({ session_id: id, mode: m, text: clean })
    },
    [enabled, mode, runTurn, putPending],
  )

  const carryOn = useCallback(() => {
    const id = sessionRef.current
    if (!enabled || !id || busy.current) return
    busy.current = true
    stopRef.current = false
    setNotices((prev) => prev.map((n) => (n.canContinue ? { ...n, canContinue: false } : n)))
    void runTurn({ session_id: id, mode })
  }, [enabled, mode, runTurn])

  const stop = useCallback(() => {
    if (!busy.current) return
    stopRef.current = true
    setStopping(true)
  }, [])

  const setMode = useCallback((next: CreativeAgentMode) => {
    if (busy.current) return
    setModeState(next)
  }, [])

  const newChat = useCallback(async (): Promise<boolean> => {
    if (busy.current) return false
    busy.current = true
    setStartingNew(true)
    try {
      const state = await createAgentSession()
      if (!mounted.current) return false
      replaceWith(state)
      setModeState(state.session.mode === 'generate' ? 'generate' : 'ask')
      setNotices([])
      setJobErrors({})
      setLastCost(null)
      setStatus('ready')
      return true
    } catch (err) {
      if (mounted.current) {
        addNotice(agentErrorMessage(err, { kind: 'turn' }, 'Could not start a new chat.'), 'error')
      }
      return false
    } finally {
      busy.current = false
      if (mounted.current) setStartingNew(false)
    }
  }, [replaceWith, addNotice])

  const jobAction = useCallback(
    async (job: CreativeAgentJob, action: AgentJobAction) => {
      if (jobBusyRef.current.has(job.id)) return
      jobBusyRef.current.add(job.id)
      setJobBusy((b) => ({ ...b, [job.id]: action }))
      setJobErrors((e) => ({ ...e, [job.id]: undefined }))
      try {
        const { job: next, budget } = action === 'approve' ? await approveAgentJob(job.id) : await cancelAgentJob(job.id)
        if (!mounted.current) return
        stampJobs([next])
        setJobs((prev) => mergeJobs(prev, [next]))
        budgetRef.current(budget)
        if (action === 'approve') bump({ gallery: true })
      } catch (err) {
        if (!mounted.current) return
        const b = errorBudget(err)
        if (b) budgetRef.current(b)
        const ctx =
          action === 'approve' ? ({ kind: 'approve', totalUsd: job.estimated_usd } as const) : ({ kind: 'cancel' } as const)
        setJobErrors((e) => ({
          ...e,
          [job.id]: agentErrorMessage(err, ctx, action === 'approve' ? 'Could not start the job.' : 'Could not stop the job.'),
        }))
        const code = err instanceof ApiError ? err.errorCode : undefined
        if (code === 'JOB_EXPIRED') setJobs((prev) => mergeJobs(prev, [{ ...job, status: 'expired' }]))
        // Someone else moved it, or the start failed half-way: show what the server has now.
        if (code !== 'JOB_EXPIRED' && code !== 'BUDGET_EXCEEDED') void reconcile()
      } finally {
        jobBusyRef.current.delete(job.id)
        if (mounted.current) setJobBusy((b) => ({ ...b, [job.id]: undefined }))
      }
    },
    [bump, reconcile],
  )

  const approve = useCallback((job: CreativeAgentJob) => jobAction(job, 'approve'), [jobAction])
  const cancel = useCallback((job: CreativeAgentJob) => jobAction(job, 'cancel'), [jobAction])

  // While a job generates, the session read is what moves it on — every 5 s, visible tab only.
  const anyRunning = useMemo(() => hasRunningJob(Object.values(jobs)), [jobs])
  usePoll(
    () => {
      const id = sessionRef.current
      if (!id || polling.current) return
      polling.current = true
      getAgentSession(id)
        .then((state) => {
          if (!mounted.current || sessionRef.current !== id) return
          absorb(state.messages, state.jobs)
          if (state.budget) budgetRef.current(state.budget)
        })
        .catch(() => {
          // A failed background read keeps what is on screen; the next tick retries.
        })
        .finally(() => {
          polling.current = false
        })
    },
    POLL_MS,
    { paused: !anyRunning || status !== 'ready' },
  )

  // A step finished or started: the Gallery has something new.
  const fingerprint = useMemo(() => jobsFingerprint(Object.values(jobs)), [jobs])
  const lastFingerprint = useRef<string | null>(null)
  useEffect(() => {
    if (lastFingerprint.current !== null && lastFingerprint.current !== fingerprint) bump({ gallery: true })
    lastFingerprint.current = fingerprint
  }, [fingerprint, bump])

  const jobReadAt = useCallback((jobId: number) => readAt.current.get(jobId) ?? 0, [])

  return {
    status,
    loadError,
    reload,
    mode,
    setMode,
    messages,
    jobs,
    notices,
    pending,
    running,
    stopping,
    progress,
    elapsed,
    lastCost,
    send,
    carryOn,
    stop,
    newChat,
    startingNew,
    approve,
    cancel,
    jobBusy,
    jobErrors,
    jobReadAt,
    signals,
  }
}
