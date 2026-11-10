import { useMemo } from 'react'
import type { AgentJobAction, AgentNotice, PendingMessage } from '../../../../../hooks/useCreativeAgent'
import type {
  CreativeAgentActivity,
  CreativeAgentJob,
  CreativeAgentMessage,
  CreativeAgentMode,
  CreativeBudget,
  CreativeGeneration,
} from '../../../../../types/creatives'
import JobCard from '../job/JobCard'
import { ActivityLines, AgentProgress, AGENT_INDENT, AssistantMessage, ChatNotice, PlanChip, UserBubble } from './ChatParts'

interface ChatTranscriptProps {
  messages: CreativeAgentMessage[]
  jobs: Record<number, CreativeAgentJob>
  notices: AgentNotice[]
  pending: PendingMessage | null
  running: boolean
  stopping: boolean
  progress: string | null
  elapsed: number
  budget: CreativeBudget
  now: number
  retentionDays: number
  /** Higgsfield is connected (a job can start). */
  configured: boolean
  jobBusy: Record<number, AgentJobAction | undefined>
  jobErrors: Record<number, string | undefined>
  onApprove: (job: CreativeAgentJob) => void
  onCancel: (job: CreativeAgentJob) => void
  onOpenPlan: (planId: number) => void
  onOpenGallery: () => void
  onDownload: (jobId: number, generation: CreativeGeneration, index: number) => Promise<string | null>
  onCarryOn: () => void
}

type Block =
  | { kind: 'user'; key: string; text: string; mode?: CreativeAgentMode }
  | { kind: 'assistant'; key: string; text: string }
  | { kind: 'activity'; key: string; items: Array<{ id: number; activity: CreativeAgentActivity }> }
  | { kind: 'plan'; key: string; title: string; planId: number }
  | { kind: 'job'; key: string; jobId: number }
  | { kind: 'notice'; key: string; text: string; tone: 'error' | 'info' | 'warn'; canContinue?: boolean }

/**
 * Server messages in id order, with the page's own notices slotted in after
 * the message each was raised beside, and a run of tool calls folded into
 * one quiet list. Thinking and raw tool blocks never reach this — the API
 * sends only what a person should read.
 */
function buildBlocks(messages: CreativeAgentMessage[], notices: AgentNotice[]): Block[] {
  const blocks: Block[] = []
  const queue = [...notices].sort((a, b) => a.afterId - b.afterId)
  let q = 0
  const flushNotices = (beforeId: number) => {
    while (q < queue.length && queue[q].afterId < beforeId) {
      const n = queue[q++]
      blocks.push({ kind: 'notice', key: n.key, text: n.text, tone: n.tone, canContinue: n.canContinue })
    }
  }

  for (const m of messages) {
    flushNotices(m.id)
    const key = `m${m.id}`
    switch (m.kind) {
      case 'user':
        if (m.text) blocks.push({ kind: 'user', key, text: m.text, mode: m.mode })
        break
      case 'assistant':
        if (m.text?.trim()) blocks.push({ kind: 'assistant', key, text: m.text })
        break
      case 'activity': {
        if (!m.activity) break
        const last = blocks[blocks.length - 1]
        if (last?.kind === 'activity') last.items.push({ id: m.id, activity: m.activity })
        else blocks.push({ kind: 'activity', key, items: [{ id: m.id, activity: m.activity }] })
        break
      }
      case 'plan':
        if (m.plan_id) blocks.push({ kind: 'plan', key, title: m.text?.trim() || `Plan #${m.plan_id}`, planId: m.plan_id })
        break
      case 'job':
        if (m.job_id) blocks.push({ kind: 'job', key, jobId: m.job_id })
        break
      case 'notice':
        if (m.text) blocks.push({ kind: 'notice', key, text: m.text, tone: 'warn' })
        break
    }
  }
  flushNotices(Number.POSITIVE_INFINITY)
  return blocks
}

export default function ChatTranscript({
  messages,
  jobs,
  notices,
  pending,
  running,
  stopping,
  progress,
  elapsed,
  budget,
  now,
  retentionDays,
  configured,
  jobBusy,
  jobErrors,
  onApprove,
  onCancel,
  onOpenPlan,
  onOpenGallery,
  onDownload,
  onCarryOn,
}: ChatTranscriptProps) {
  const blocks = useMemo(() => buildBlocks(messages, notices), [messages, notices])

  return (
    <div className="flex flex-col gap-5" aria-live="polite" aria-relevant="additions">
      {blocks.map((b) => {
        switch (b.kind) {
          case 'user':
            return <UserBubble key={b.key} text={b.text} mode={b.mode} />
          case 'assistant':
            return <AssistantMessage key={b.key} text={b.text} />
          case 'activity':
            return <ActivityLines key={b.key} items={b.items} />
          case 'plan':
            return <PlanChip key={b.key} title={b.title} onOpen={() => onOpenPlan(b.planId)} />
          case 'notice':
            return (
              <ChatNotice
                key={b.key}
                text={b.text}
                tone={b.tone}
                onContinue={b.canContinue ? onCarryOn : undefined}
                continueDisabled={running}
              />
            )
          case 'job': {
            const job = jobs[b.jobId]
            if (!job) return null
            return (
              <div key={b.key} className={`${AGENT_INDENT} animate-[fadeup_0.35s_ease-out]`}>
                <JobCard
                  job={job}
                  budget={budget}
                  now={now}
                  retentionDays={retentionDays}
                  configured={configured}
                  busy={jobBusy[job.id]}
                  error={jobErrors[job.id]}
                  onApprove={onApprove}
                  onCancel={onCancel}
                  onOpenPlan={onOpenPlan}
                  onOpenGallery={onOpenGallery}
                  onDownload={(g, i) => onDownload(job.id, g, i)}
                />
              </div>
            )
          }
        }
        return null
      })}

      {pending && <UserBubble text={pending.text} mode={pending.mode} sending />}
      {running && <AgentProgress label={progress} elapsed={elapsed} stopping={stopping} />}
    </div>
  )
}
