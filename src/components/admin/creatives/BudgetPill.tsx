import { Wallet } from 'lucide-react'
import { fmtBudget } from '../../../lib/creatives'
import type { CreativeBudget } from '../../../types/creatives'

interface BudgetPillProps {
  budget: CreativeBudget
  onOpen: () => void
  /** The Budget panel is open — the pill reads as pressed. */
  active?: boolean
}

/**
 * "$72.40 left" in the workspace's top bar — the budget is always in view
 * while talking to the agent. The cap is added once there is room (1536px);
 * the tooltip always has it.
 */
export default function BudgetPill({ budget, onOpen, active = false }: BudgetPillProps) {
  const low = budget.cap_usd <= 0 || budget.remaining_usd < budget.cap_usd * 0.1
  const full = `${fmtBudget(budget.remaining_usd)} left of ${fmtBudget(budget.cap_usd)} this month`
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${full} — open the budget`}
      aria-label={`Budget: ${full}`}
      aria-pressed={active}
      className={`inline-flex min-h-9 flex-none cursor-pointer items-center gap-2 whitespace-nowrap rounded-pill border px-3.5 text-[12px] font-semibold transition-colors duration-150 ${
        low
          ? 'border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] text-red'
          : active
            ? 'border-accent-line bg-accent-soft text-accent'
            : 'border-border bg-surface text-muted hover:border-accent-line hover:text-text'
      }`}
    >
      <Wallet size={14} aria-hidden="true" className="flex-none" />
      <span>
        <strong className={`font-bold ${low ? 'text-red' : 'text-text'}`}>{fmtBudget(budget.remaining_usd)}</strong>
        <span className="max-[420px]:sr-only"> left</span>
        <span className="hidden 2xl:inline"> of {fmtBudget(budget.cap_usd)} this month</span>
      </span>
    </button>
  )
}
