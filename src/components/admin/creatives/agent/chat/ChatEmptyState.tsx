import { Clapperboard, Lightbulb, PenLine, PlugZap, Sparkles, SquareKanban } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AGENT_STARTERS, type AgentStarter } from '../../../../../lib/creativesAgent'
import { AI_NOT_CONNECTED } from '../../../../../lib/creativesAi'
import { GenerateTag } from './ChatParts'

interface ChatEmptyStateProps {
  /** Claude is connected — without it there is nothing to start. */
  enabled: boolean
  /** A starter is being sent (or the mode is switching for it). */
  busy: boolean
  onStart: (starter: AgentStarter) => void
}

const STARTER_ICON: LucideIcon[] = [Clapperboard, Lightbulb, PenLine, SquareKanban]

/**
 * A new chat: one short greeting and four starters. A starter that makes
 * something switches to Generate first, where everyone can see it — and even
 * then the agent only proposes; nothing is spent before Go.
 */
export default function ChatEmptyState({ enabled, busy, onStart }: ChatEmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-1 py-10 text-center sm:py-16">
      <span
        className="grid h-14 w-14 place-items-center rounded-[18px] border border-accent-line bg-[linear-gradient(160deg,var(--accentSoft),var(--surface))] text-accent shadow-[0_14px_36px_var(--glow)]"
        aria-hidden="true"
        data-aos="fade-up"
      >
        <Sparkles size={24} />
      </span>
      <h2
        className="mt-6 font-display text-[24px] font-extrabold leading-[1.2] tracking-[-0.02em] text-text sm:text-[30px]"
        data-aos="fade-up"
        data-aos-delay={40}
      >
        What shall we make?
      </h2>
      <p className="mt-3 max-w-[540px] text-[14px] leading-[1.7] text-muted" data-aos="fade-up" data-aos-delay={80}>
        I’m the Pixel Alpha content agent. Ask me for post ideas, hooks or what’s in the planner — or switch to
        Generate and I’ll make the video with Pixel. Every paid job shows its price and waits for your Go.
      </p>

      {enabled ? (
        <div className="mt-9 grid w-full max-w-[640px] grid-cols-1 gap-2.5 sm:grid-cols-2">
          {AGENT_STARTERS.map((s, i) => {
            const Icon = STARTER_ICON[i] ?? Sparkles
            return (
              <button
                key={s.text}
                type="button"
                onClick={() => onStart(s)}
                disabled={busy}
                data-aos="fade-up"
                data-aos-delay={120 + i * 50}
                className="group flex min-h-[64px] min-w-0 cursor-pointer items-center gap-3 rounded-row border border-border bg-surface px-4 py-3 text-left transition-[border-color,background] duration-150 hover:border-accent-line hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span
                  className="grid h-9 w-9 flex-none place-items-center rounded-[10px] border border-hair bg-surface2 text-muted transition-colors duration-150 group-hover:text-accent"
                  aria-hidden="true"
                >
                  <Icon size={16} />
                </span>
                <span className="min-w-0 flex-1 text-[13.5px] font-semibold leading-[1.4] text-text">{s.text}</span>
                {s.mode === 'generate' && <GenerateTag />}
              </button>
            )
          })}
        </div>
      ) : (
        <div
          className="mt-9 flex w-full max-w-[560px] items-start gap-3 rounded-row border border-accent-line bg-accent-soft px-4 py-3.5 text-left"
          role="status"
          data-aos="fade-up"
          data-aos-delay={120}
        >
          <PlugZap size={17} aria-hidden="true" className="mt-0.5 flex-none text-accent" />
          <div className="min-w-0 text-[12.5px] leading-[1.6]">
            <p className="font-bold text-text">{AI_NOT_CONNECTED}</p>
            <p className="mt-0.5 text-muted">
              The agent can’t answer here until it is. The panels — plans, gallery, Pixel, brief, memory and budget —
              all still work.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
