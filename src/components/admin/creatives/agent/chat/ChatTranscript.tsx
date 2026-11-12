import { useMemo } from 'react'
import type { AgentJobAction, AgentNotice, PendingMessage } from '../../../../../hooks/useCreativeAgent'
import type {
  CreativeAgentActivity,
  CreativeAgentChoices,
  CreativeAgentJob,
  CreativeAgentMessage,
  CreativeAgentMode,
  CreativeBudget,
  CreativeGeneration,
  CreativeStoryboard,
} from '../../../../../types/creatives'
import { choiceAnswers } from '../../../../../lib/creativesAgent'
import { editorPath } from '../../../../../lib/creativeVideos'
import JobCard from '../job/JobCard'
import { ActivityLines, AgentProgress, AGENT_INDENT, AssistantMessage, ChatNotice, PlanChip, UserBubble, VideoChip } from './ChatParts'
import ChoiceCard from './ChoiceCard'
import StoryboardCard from './StoryboardCard'

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
  /** A choice button: send its value as the next message. */
  onChoose: (value: string) => void
  /** Open a video project's editor (a website path). */
  onOpenEditor: (path: string) => void
  /** Inside a video's editor: that video — its chip and job cards don't offer to open the editor again. */
  currentVideoId?: number
}

type Block =
  | { kind: 'user'; key: string; text: string; mode?: CreativeAgentMode }
  | { kind: 'assistant'; key: string; text: string; thinking: string | null }
  | { kind: 'activity'; key: string; items: Array<{ id: number; activity: CreativeAgentActivity }> }
  | { kind: 'plan'; key: string; title: string; planId: number }
  | { kind: 'job'; key: string; jobId: number }
  | { kind: 'notice'; key: string; text: string; tone: 'error' | 'info' | 'warn'; canContinue?: boolean }
  | { kind: 'choices'; key: string; choices: CreativeAgentChoices; answer: string | null }
  | { kind: 'video'; key: string; title: string; videoId: number }
  | { kind: 'storyboard'; key: string; storyboard: CreativeStoryboard }

/**
 * Server messages in id order, with the page's own notices slotted in after
 * the message each was raised beside, and a run of tool calls folded into
 * one quiet list. Raw tool blocks never reach this — the API sends only what
 * a person should read; a step's thinking arrives as its SUMMARY, folded
 * above that step ("How it's thinking"), even a step that said nothing.
 */
function buildBlocks(messages: CreativeAgentMessage[], notices: AgentNotice[]): Block[] {
  const blocks: Block[] = []
  const answers = choiceAnswers(messages)
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
      case 'assistant': {
        const thinking = m.thinking?.trim() ? m.thinking : null
        if (m.text?.trim() || thinking) blocks.push({ kind: 'assistant', key, text: m.text ?? '', thinking })
        break
      }
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
      case 'choices':
        if (m.choices && m.choices.options?.length) {
          blocks.push({ kind: 'choices', key, choices: m.choices, answer: answers.get(m.id) ?? null })
        }
        break
      case 'video':
        if (m.video_id) blocks.push({ kind: 'video', key, title: m.text?.trim() || `Video #${m.video_id}`, videoId: m.video_id })
        break
      case 'storyboard':
        if (m.storyboard && m.storyboard.scenes?.length) blocks.push({ kind: 'storyboard', key, storyboard: m.storyboard })
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
  onChoose,
  onOpenEditor,
  currentVideoId,
}: ChatTranscriptProps) {
  const blocks = useMemo(() => buildBlocks(messages, notices), [messages, notices])

  return (
    <div className="flex flex-col gap-5" aria-live="polite" aria-relevant="additions">
      {blocks.map((b) => {
        switch (b.kind) {
          case 'user':
            return <UserBubble key={b.key} text={b.text} mode={b.mode} />
          case 'assistant':
            return <AssistantMessage key={b.key} text={b.text} thinking={b.thinking} />
          case 'activity':
            return <ActivityLines key={b.key} items={b.items} />
          case 'plan':
            return <PlanChip key={b.key} title={b.title} onOpen={() => onOpenPlan(b.planId)} />
          case 'storyboard':
            return <StoryboardCard key={b.key} storyboard={b.storyboard} />
          case 'video':
            return (
              <VideoChip
                key={b.key}
                title={b.title}
                onOpen={b.videoId === currentVideoId ? undefined : () => onOpenEditor(editorPath(b.videoId))}
              />
            )
          case 'choices':
            return (
              <ChoiceCard
                key={b.key}
                choices={b.choices}
                answer={b.answer}
                disabled={running || pending !== null}
                onChoose={onChoose}
              />
            )
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
                  onOpenEditor={job.video_id && job.video_id === currentVideoId ? undefined : onOpenEditor}
                  hideGallery={!!job.video_id && job.video_id === currentVideoId}
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
