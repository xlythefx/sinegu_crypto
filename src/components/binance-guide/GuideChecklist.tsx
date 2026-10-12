import { RotateCcw } from 'lucide-react'
import type { GuidePart } from '../../lib/binanceGuide'
import { scrollToSection } from '../../lib/scroll'
import TickBox from './TickBox'

/**
 * Every step of both parts, ticked off as the reader goes. A skipped Part 1
 * stays listed as one line — the reader can see what they skipped and undo
 * it — and is left out of the count.
 */
export default function GuideChecklist({
  parts,
  done,
  hasAccount,
  toggle,
  reset,
  onShowAccount,
}: {
  parts: GuidePart[]
  done: string[]
  hasAccount: boolean
  toggle: (id: string) => void
  reset: () => void
  onShowAccount: () => void
}) {
  const visible = parts.filter((p) => !(p.skippable && hasAccount)).flatMap((p) => p.steps)
  const count = visible.filter((s) => done.includes(s.id)).length
  const pct = visible.length ? Math.round((count / visible.length) * 100) : 0

  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-display text-[16px] font-bold">Your checklist</div>
        <div className="font-mono text-[12px] text-muted">
          {count} of {visible.length} done
        </div>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-surface2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={visible.length}
        aria-valuenow={count}
        aria-label="Steps completed"
      >
        <div
          className="h-full rounded-full bg-green transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {parts.map((part) => {
        const skipped = part.skippable && hasAccount
        return (
          <div key={part.id} className="mt-5">
            <button
              type="button"
              onClick={() => scrollToSection(`part-${part.id}`)}
              className="text-left font-mono text-[11px] uppercase tracking-widest text-faint transition-colors hover:text-accent"
            >
              {part.label} · {part.title}
            </button>
            {skipped ? (
              <p className="mt-2 px-1.5 text-[13px] leading-snug text-faint">
                Skipped — you already have Binance.{' '}
                <button
                  type="button"
                  onClick={onShowAccount}
                  className="font-semibold text-muted underline-offset-2 hover:text-text hover:underline"
                >
                  Show it
                </button>
              </p>
            ) : (
              <ol className="mt-2 flex flex-col gap-1">
                {part.steps.map((step, i) => {
                  const checked = done.includes(step.id)
                  return (
                    <li key={step.id} className="flex items-center gap-3 rounded-field px-1.5 py-1.5">
                      <TickBox
                        size="sm"
                        checked={checked}
                        number={i + 1}
                        onToggle={() => toggle(step.id)}
                        label={`${part.label}, step ${i + 1}: ${step.title}`}
                      />
                      <button
                        type="button"
                        onClick={() => scrollToSection(`step-${step.id}`)}
                        className={`min-w-0 text-left text-[13.5px] leading-snug transition-colors hover:text-accent ${
                          checked ? 'text-faint line-through' : 'text-text'
                        }`}
                      >
                        {step.title}
                      </button>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        )
      })}

      {count > 0 && (
        <button
          type="button"
          onClick={reset}
          className="mt-4 inline-flex items-center gap-1.5 px-1.5 text-[12px] font-semibold text-muted transition-colors hover:text-text"
        >
          <RotateCcw size={12} />
          Start over
        </button>
      )}
    </div>
  )
}
