import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { ArrowUp, Square } from 'lucide-react'
import { fmtCost } from '../../../../../lib/creatives'
import { AGENT_TEXT_MAX } from '../../../../../lib/creativesAgent'
import type { CreativeAgentMode } from '../../../../../types/creatives'

interface ChatComposerProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onStop: () => void
  mode: CreativeAgentMode
  /** A turn is running: the box is locked and Send becomes Stop. */
  running: boolean
  stopping: boolean
  /** Nothing can be sent at all (no Claude on this server, the chat not loaded). */
  disabled: boolean
  /** What the box says when it is off. */
  disabledPlaceholder?: string
  /** What the last answer cost, all its steps together. */
  lastCost: number | null
}

/** The box grows with what is typed, up to this, then scrolls. */
const MAX_HEIGHT = 220

/**
 * A touch keyboard has no Shift+Enter, so there Enter is a new line and the
 * send button sends; with a real keyboard Enter sends.
 */
const touchOnly = () =>
  typeof window !== 'undefined' && window.matchMedia('(hover: none) and (pointer: coarse)').matches

/** Short enough for one line on a phone; the bar above already says what each mode may do. */
const PLACEHOLDER: Record<CreativeAgentMode, string> = {
  ask: 'Ask about ideas, the plan or results…',
  generate: 'Describe what to make…',
}

/**
 * The message box, pinned to the bottom of the chat. Enter sends, Shift+Enter
 * is a new line (and Enter while composing an accented character never
 * sends; on a touch keyboard Enter is a new line and the button sends). Locked while the agent works; Stop asks for no further steps — the
 * one in flight still lands. In Generate mode its edge turns gold.
 */
export default function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  mode,
  running,
  stopping,
  disabled,
  disabledPlaceholder,
  lastCost,
}: ChatComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const locked = disabled || running
  const canSend = !locked && value.trim() !== '' && value.length <= AGENT_TEXT_MAX

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
  }, [value])

  // Back to the box once the agent has answered, so the conversation flows —
  // never on a phone, where focusing would pop the keyboard over the answer.
  const wasRunning = useRef(running)
  useEffect(() => {
    if (wasRunning.current && !running && !disabled && !touchOnly()) ref.current?.focus({ preventScroll: true })
    wasRunning.current = running
  }, [running, disabled])

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing || touchOnly()) return
    e.preventDefault()
    if (canSend) onSend()
  }

  const near = value.length > AGENT_TEXT_MAX - 400
  const generate = mode === 'generate'

  return (
    <div className="sticky bottom-0 z-20 bg-[linear-gradient(to_top,var(--bg)_72%,transparent)] pb-4 pt-6 sm:pb-5">
      <div className="mx-auto w-full max-w-[760px]">
        <div
          className={`rounded-[20px] border bg-surface shadow-[0_14px_40px_rgba(0,0,0,0.22)] transition-[border-color,box-shadow] duration-150 focus-within:shadow-[0_14px_40px_var(--glow)] ${
            generate ? 'border-accent-line' : 'border-border focus-within:border-accent-line'
          } ${disabled ? 'opacity-70' : ''}`}
        >
          <label className="block">
            <span className="sr-only">Message the agent</span>
            <textarea
              ref={ref}
              rows={1}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={locked}
              maxLength={AGENT_TEXT_MAX}
              placeholder={disabled ? (disabledPlaceholder ?? 'The agent is off here') : PLACEHOLDER[mode]}
              className="block max-h-[220px] min-h-[52px] w-full resize-none border-0 bg-transparent px-4 pb-1.5 pt-3.5 font-body text-[14px] leading-[1.6] text-text outline-none placeholder:text-faint disabled:cursor-not-allowed"
            />
          </label>
          <div className="flex min-h-12 items-center gap-2 px-2.5 pb-2.5 pl-4">
            <span
              className={`text-[11.5px] font-semibold ${generate ? 'text-accent' : 'text-faint'}`}
              aria-hidden="true"
            >
              {generate ? 'Generate mode' : 'Ask mode'}
            </span>
            {near && (
              <span
                className={`ml-auto font-mono text-[11px] tabular-nums ${value.length > AGENT_TEXT_MAX ? 'text-red' : 'text-faint'}`}
              >
                {value.length.toLocaleString()} / {AGENT_TEXT_MAX.toLocaleString()}
              </span>
            )}
            {running ? (
              <button
                type="button"
                onClick={onStop}
                disabled={stopping}
                className={`${near ? '' : 'ml-auto'} inline-flex h-10 flex-none cursor-pointer items-center gap-2 rounded-pill border border-border bg-surface2 px-4 text-[12.5px] font-bold text-text transition-colors duration-150 hover:border-[color-mix(in_srgb,var(--red)_45%,transparent)] hover:text-red disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <Square size={12} aria-hidden="true" className="fill-current" />
                {stopping ? 'Stopping…' : 'Stop'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onSend}
                disabled={!canSend}
                aria-label="Send"
                className={`${near ? '' : 'ml-auto'} inline-flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-full border border-transparent bg-accent text-on-accent shadow-[0_8px_20px_var(--glow)] transition-[filter,opacity] duration-150 hover:brightness-[1.06] disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none`}
              >
                <ArrowUp size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <div className="mt-2 flex min-h-4 items-center justify-between gap-3 px-1.5 text-[11px] text-faint">
          <span className="max-sm:hidden">Enter to send · Shift + Enter for a new line</span>
          {lastCost !== null && <span className="ml-auto tabular-nums">Last answer cost {fmtCost(lastCost)}</span>}
        </div>
      </div>
    </div>
  )
}
