import { useId, useState } from 'react'
import { Brain, ChevronDown, ChevronRight, CircleAlert, Clapperboard, Film, Info, LoaderCircle, RotateCw, SquareKanban, Sparkles, TriangleAlert, X } from 'lucide-react'
import Markdown from '../../../../ui/Markdown'
import type { CreativeAgentActivity, CreativeAgentMode } from '../../../../../types/creatives'
import { NOTICE } from '../../creativeClasses'
import { toolIcon } from '../agentIcons'

/**
 * Everything the agent says sits right of its avatar; the indent lines its
 * activity up with its words. Measured on the CHAT's width (a container
 * query on the nearest `@container`), not the screen's: the editor's chat
 * panel is 380 px on a wide screen and has no room for the avatar gutter.
 */
export const AGENT_INDENT = 'pl-0 @[560px]:pl-10'
/** The avatar shows only where the indent does. */
const AVATAR_SHOWN = 'hidden @[560px]:grid'

/** The small Generate tag — on a user message sent in Generate mode, and on Generate starters. */
export function GenerateTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-pill border border-accent-line bg-accent-soft px-2 py-[2px] text-[10.5px] font-bold uppercase tracking-[0.06em] text-accent">
      <Clapperboard size={10} aria-hidden="true" />
      Generate
    </span>
  )
}

/** What a person wrote — right-aligned, plain text exactly as typed. */
export function UserBubble({ text, mode, sending = false }: { text: string; mode?: CreativeAgentMode; sending?: boolean }) {
  return (
    <div className="flex flex-col items-end gap-1.5 animate-[fadeup_0.3s_ease-out]">
      {mode === 'generate' && <GenerateTag />}
      <div
        className={`max-w-[88%] whitespace-pre-wrap break-words rounded-[18px] rounded-br-[6px] border border-border bg-surface px-4 py-2.5 text-[14px] leading-[1.6] text-text shadow-[0_6px_18px_rgba(0,0,0,0.08)] sm:max-w-[80%] ${
          sending ? 'opacity-80' : ''
        }`}
      >
        {text}
      </div>
    </div>
  )
}

function AgentAvatar() {
  return (
    <span
      className={`mt-0.5 ${AVATAR_SHOWN} h-7 w-7 flex-none place-items-center rounded-full border border-accent-line bg-accent-soft text-accent`}
      aria-hidden="true"
    >
      <Sparkles size={14} />
    </span>
  )
}

/**
 * "How it's thinking": the model's thinking summary for one step, folded
 * by default and muted when open — the reasoning behind what it says and
 * plans, for whoever wants to read it.
 */
export function ThinkingLine({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="inline-flex w-fit max-w-full cursor-pointer items-center gap-1.5 rounded-pill border border-transparent bg-transparent py-0.5 pr-1.5 text-[12px] font-semibold text-faint transition-colors duration-150 hover:text-muted"
      >
        <Brain size={13} aria-hidden="true" className="flex-none" />
        How it’s thinking
        <ChevronDown size={13} aria-hidden="true" className={`flex-none transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          id={id}
          className="min-w-0 border-l-2 border-hair pl-3 animate-[fadeup_0.25s_ease-out] [&_h3]:text-muted [&_h4]:text-muted [&_h5]:text-muted [&_strong]:text-muted"
        >
          <Markdown size="sm" className="text-[12.5px]! leading-[1.6]! text-muted!">
            {text}
          </Markdown>
        </div>
      )}
    </div>
  )
}

/** The agent's answer, rendered from Markdown (raw HTML never), with its thinking folded above it. */
export function AssistantMessage({ text, thinking }: { text: string; thinking?: string | null }) {
  const hasText = text.trim() !== ''
  const hasThinking = !!thinking && thinking.trim() !== ''
  return (
    <div className="flex min-w-0 gap-3 animate-[fadeup_0.3s_ease-out]">
      {hasText ? <AgentAvatar /> : <span className={`${AVATAR_SHOWN} w-7 flex-none`} aria-hidden="true" />}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {hasThinking && <ThinkingLine text={thinking as string} />}
        {hasText && <Markdown>{text}</Markdown>}
      </div>
    </div>
  )
}

/** A run of tools the agent ran, one quiet grey line each ("Read the planner"). */
export function ActivityLines({ items }: { items: Array<{ id: number; activity: CreativeAgentActivity }> }) {
  return (
    <ul className={`flex flex-col gap-1.5 ${AGENT_INDENT} animate-[fadeup_0.3s_ease-out]`} aria-label="What the agent did">
      {items.map(({ id, activity }) => {
        const Icon = toolIcon(activity.tool)
        return (
          <li key={id} className="flex min-w-0 items-start gap-2 text-[12.5px] leading-[1.5] text-faint">
            {activity.ok ? (
              <Icon size={13} aria-hidden="true" className="mt-[3px] flex-none" />
            ) : (
              <TriangleAlert size={13} aria-hidden="true" className="mt-[3px] flex-none text-red" />
            )}
            <span className={`min-w-0 break-words ${activity.ok ? '' : 'text-muted'}`}>{activity.label}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** "Created plan: …" — opens the Plans panel at that plan. */
export function PlanChip({ title, onOpen }: { title: string; onOpen: () => void }) {
  return (
    <div className={`${AGENT_INDENT} animate-[fadeup_0.3s_ease-out]`}>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex max-w-full cursor-pointer items-center gap-2.5 rounded-pill border border-border bg-surface py-1.5 pl-2 pr-3 text-left transition-[border-color] duration-150 hover:border-accent-line"
      >
        <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-accent-soft text-accent" aria-hidden="true">
          <SquareKanban size={13} />
        </span>
        <span className="min-w-0 truncate text-[12.5px] text-muted">
          Created plan: <strong className="font-bold text-text">{title}</strong>
        </span>
        <ChevronRight size={14} aria-hidden="true" className="flex-none text-faint" />
      </button>
    </div>
  )
}

/** "Video: <title> — Open the editor": a video project the agent made. Without `onOpen` it is the video already open. */
export function VideoChip({ title, onOpen }: { title: string; onOpen?: () => void }) {
  if (!onOpen) {
    return (
      <div className={`${AGENT_INDENT} animate-[fadeup_0.3s_ease-out]`}>
        <span className="inline-flex max-w-full items-center gap-2.5 rounded-pill border border-accent-line bg-accent-soft py-1.5 pl-2 pr-3">
          <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-surface text-accent" aria-hidden="true">
            <Film size={13} />
          </span>
          <span className="min-w-0 truncate text-[12.5px] text-muted">
            Video: <strong className="font-bold text-text">{title}</strong>
            <span className="text-accent"> — this one</span>
          </span>
        </span>
      </div>
    )
  }
  return (
    <div className={`${AGENT_INDENT} animate-[fadeup_0.3s_ease-out]`}>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex max-w-full cursor-pointer items-center gap-2.5 rounded-pill border border-accent-line bg-accent-soft py-1.5 pl-2 pr-3 text-left transition-[border-color,background] duration-150 hover:bg-surface"
      >
        <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-surface text-accent" aria-hidden="true">
          <Film size={13} />
        </span>
        <span className="min-w-0 truncate text-[12.5px] text-muted">
          Video: <strong className="font-bold text-text">{title}</strong>
          <span className="text-accent"> — Open the editor</span>
        </span>
        <ChevronRight size={14} aria-hidden="true" className="flex-none text-accent" />
      </button>
    </div>
  )
}

/** A notice in the chat: from the server (amber), or one the page raised (an error, "Stopped"). */
export function ChatNotice({
  text,
  tone,
  onContinue,
  continueDisabled,
  onDismiss,
}: {
  text: string
  tone: 'error' | 'info' | 'warn'
  onContinue?: () => void
  continueDisabled?: boolean
  onDismiss?: () => void
}) {
  const Icon = tone === 'error' ? CircleAlert : tone === 'info' ? Info : TriangleAlert
  return (
    <div className={`${NOTICE[tone]} animate-[fadeup_0.3s_ease-out]`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={15} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-0 flex-1">{text}</span>
        {onContinue && (
          <button
            type="button"
            onClick={onContinue}
            disabled={continueDisabled}
            className="inline-flex min-h-8 flex-none cursor-pointer items-center gap-1.5 rounded-field border border-accent-line bg-surface px-3 text-[12px] font-bold text-accent transition-colors duration-150 hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCw size={13} aria-hidden="true" />
            Carry on
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-my-1 -mr-1 inline-flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-btn text-muted transition-colors duration-150 hover:bg-surface hover:text-text"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

/** While a turn runs: what it is doing now, and for how long. */
export function AgentProgress({ label, elapsed, stopping }: { label: string | null; elapsed: number; stopping: boolean }) {
  const text = stopping
    ? 'Stopping after this step…'
    : label
      ? `${label.replace(/[.\s]+$/, '')} — thinking about the next step…`
      : 'Thinking…'
  return (
    <div className="flex min-w-0 items-center gap-3 animate-[fadeup_0.3s_ease-out]">
      <span
        className={`${AVATAR_SHOWN} h-7 w-7 flex-none place-items-center rounded-full border border-accent-line bg-accent-soft text-accent`}
        aria-hidden="true"
      >
        <LoaderCircle size={14} className="animate-spin" />
      </span>
      <LoaderCircle size={15} aria-hidden="true" className="flex-none animate-spin text-accent @[560px]:hidden" />
      <p className="min-w-0 flex-1 text-[13px] font-semibold text-muted" role="status">
        {text}
      </p>
      <span className="flex-none font-mono text-[11.5px] tabular-nums text-faint" aria-hidden="true">
        {elapsed} s
      </span>
    </div>
  )
}
