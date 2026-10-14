import { Check } from 'lucide-react'

interface Props {
  steps: readonly { key: string; label: string }[]
  /** Index of the step on screen. */
  current: number
  /** Jump back to an earlier step (never forward — later steps are not checked yet). */
  onJump: (index: number) => void
}

/**
 * "STEP 2 OF 4" over one bar segment per step, each named underneath. A
 * finished step's name is a button back to it; the current and upcoming ones
 * are plain text.
 */
export default function WizardProgress({ steps, current, onJump }: Props) {
  return (
    <div className="mb-6">
      <p className="mb-2.5 font-mono text-[11px] tracking-[0.14em] text-accent">
        STEP {current + 1} OF {steps.length}
      </p>
      <ol className="m-0 grid list-none gap-2 p-0" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((step, i) => {
          const done = i < current
          const here = i === current
          const bar = (
            <span
              className={`block h-1.5 rounded-full transition-colors duration-300 ${
                done || here ? 'bg-accent' : 'bg-border'
              } ${here ? 'shadow-[0_0_0_3px_var(--glowAuth)]' : ''}`}
            />
          )
          const name = (
            <span
              className={`mt-1.5 flex items-center gap-1 truncate text-[11.5px] font-semibold ${
                here ? 'text-text' : done ? 'text-muted' : 'text-faint'
              }`}
            >
              {done && <Check size={11} strokeWidth={3} className="shrink-0 text-accent" />}
              <span className="truncate">{step.label}</span>
            </span>
          )
          return (
            <li key={step.key} aria-current={here ? 'step' : undefined} className="min-w-0">
              {done ? (
                <button
                  type="button"
                  className="block w-full min-w-0 cursor-pointer border-0 bg-transparent p-0 text-left hover:[&>span:last-child]:text-text"
                  onClick={() => onJump(i)}
                  title={`Back to ${step.label}`}
                >
                  {bar}
                  {name}
                </button>
              ) : (
                <>
                  {bar}
                  {name}
                </>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
