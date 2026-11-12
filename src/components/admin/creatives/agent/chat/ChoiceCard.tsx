import { useState } from 'react'
import { Check, ListChecks, Send } from 'lucide-react'
import type { CreativeAgentChoices } from '../../../../../types/creatives'
import { AGENT_INDENT } from './ChatParts'

interface ChoiceCardProps {
  choices: CreativeAgentChoices
  /** What was answered (the next user message), null while it is still open. */
  answer: string | null
  /** A turn is running — the buttons wait. */
  disabled: boolean
  /** Sends the value as the next message, in the current mode. */
  onChoose: (value: string) => void
}

const OPTION =
  'inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-field border px-4 text-[13px] font-bold transition-[border-color,background,color,opacity] duration-150 disabled:cursor-not-allowed'

/**
 * The agent asked a question with buttons ("X or TikTok?"). A click sends
 * that option's value as the next message; "Other…" lets a person type
 * their own answer. Once anyone answers (a later message exists) the card
 * greys out and stays in the transcript as history, with the answer ticked.
 */
export default function ChoiceCard({ choices, answer, disabled, onChoose }: ChoiceCardProps) {
  const [other, setOther] = useState(false)
  const [text, setText] = useState('')
  const answered = answer !== null
  const off = answered || disabled

  const sendOther = () => {
    const v = text.trim()
    if (!v || off) return
    onChoose(v)
    setText('')
    setOther(false)
  }

  return (
    <div className={`${AGENT_INDENT} animate-[fadeup_0.3s_ease-out]`}>
      <div
        className={`flex min-w-0 flex-col gap-3.5 rounded-card border p-4 sm:p-5 ${
          answered ? 'border-hair bg-surface/60' : 'border-accent-line bg-[linear-gradient(165deg,var(--accentSoft),var(--surface)_60%)]'
        }`}
        role="group"
        aria-label={choices.question}
      >
        <p className="flex items-start gap-2.5 text-[14px] font-semibold leading-[1.5] text-text">
          <ListChecks size={16} aria-hidden="true" className={`mt-0.5 flex-none ${answered ? 'text-faint' : 'text-accent'}`} />
          <span className="min-w-0 break-words">{choices.question}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {choices.options.map((o) => {
            const picked = answered && answer?.trim() === o.value.trim()
            return (
              <button
                key={o.value}
                type="button"
                disabled={off}
                onClick={() => onChoose(o.value)}
                aria-pressed={picked}
                className={`${OPTION} ${
                  picked
                    ? 'border-accent bg-accent-soft text-accent'
                    : answered
                      ? 'border-hair bg-transparent text-faint'
                      : 'border-border bg-surface text-text hover:border-accent-line hover:bg-accent-soft disabled:opacity-50'
                }`}
              >
                {picked && <Check size={14} aria-hidden="true" />}
                {o.label}
              </button>
            )
          })}
          {choices.allow_other && !answered && (
            <button
              type="button"
              disabled={off}
              onClick={() => setOther((v) => !v)}
              aria-expanded={other}
              className={`${OPTION} border-dashed border-border bg-transparent text-muted hover:border-accent-line hover:text-text disabled:opacity-50`}
            >
              Other…
            </button>
          )}
        </div>
        {other && !answered && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              sendOther()
            }}
          >
            <input
              className="h-10 min-w-0 flex-1 rounded-field border border-border bg-surface2 px-3 text-[13px] text-text outline-none focus:border-accent-line"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Your own answer"
              maxLength={500}
              autoFocus
              aria-label="Your own answer"
            />
            <button
              type="submit"
              disabled={off || !text.trim()}
              className="inline-flex h-10 flex-none cursor-pointer items-center gap-1.5 rounded-field border border-transparent bg-accent px-4 text-[13px] font-bold text-on-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={14} aria-hidden="true" />
              Send
            </button>
          </form>
        )}
        {answered && answer && !choices.options.some((o) => o.value.trim() === answer.trim()) && (
          <p className="text-[12px] text-muted">Answered: “{answer}”</p>
        )}
      </div>
    </div>
  )
}
