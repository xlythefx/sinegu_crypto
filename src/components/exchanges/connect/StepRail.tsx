import { Check } from 'lucide-react'

export interface WizardStep {
  key: string
  label: string
  /** One line describing what the step asks for. */
  hint: string
}

interface StepRailProps {
  steps: WizardStep[]
  /** Index of the step being shown. */
  current: number
  /** Jump back to an already-completed step. Forward jumps are refused. */
  onJump: (index: number) => void
}

/**
 * Progress rail for the connect wizard.
 *
 * Two renderings of the same state: the full numbered rail from 760px up, and
 * a "Step 2 of 4" line with a progress bar below that — a four-column rail at
 * phone width either truncates its labels into noise or forces a horizontal
 * scroll, and this page is most likely to be used on a phone, next to the
 * Binance app the keys are being copied from.
 */
export default function StepRail({ steps, current, onJump }: StepRailProps) {
  const pct = ((current + 1) / steps.length) * 100

  return (
    <>
      <ol className="mb-5 hidden items-center gap-2 min-[760px]:flex">
        {steps.map((step, i) => {
          const done = i < current
          const active = i === current
          return (
            <li key={step.key} className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-rail border px-3 py-2.5 text-left transition-[border-color,background] duration-150 ${
                  active
                    ? 'border-accent-line bg-accent-soft'
                    : 'border-border bg-surface'
                } ${done ? 'cursor-pointer hover:border-accent-line' : 'cursor-default'}`}
                onClick={() => done && onJump(i)}
                disabled={!done}
                aria-current={active ? 'step' : undefined}
              >
                <span
                  className={`grid h-7 w-7 flex-none place-items-center rounded-full font-mono text-[11.5px] font-bold ${
                    done
                      ? 'bg-green text-[var(--bg)]'
                      : active
                        ? 'bg-accent text-on-accent'
                        : 'bg-surface2 text-faint'
                  }`}
                >
                  {done ? <Check size={14} /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block truncate text-[12.5px] font-bold ${
                      active || done ? 'text-text' : 'text-muted'
                    }`}
                  >
                    {step.label}
                  </span>
                  <span className="block truncate text-[11px] text-faint">
                    {step.hint}
                  </span>
                </span>
              </button>
              {i < steps.length - 1 && (
                <span
                  className={`h-px w-3 flex-none ${done ? 'bg-green' : 'bg-border'}`}
                  aria-hidden="true"
                />
              )}
            </li>
          )
        })}
      </ol>

      <div className="mb-5 min-[760px]:hidden">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-mono text-[10.5px] font-semibold tracking-[0.14em] text-accent">
            STEP {current + 1} OF {steps.length}
          </p>
          <p className="truncate text-[12.5px] font-bold text-text">
            {steps[current].label}
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-pill bg-surface2">
          <div
            className="h-full rounded-pill bg-accent transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11.5px] text-muted">{steps[current].hint}</p>
      </div>
    </>
  )
}
