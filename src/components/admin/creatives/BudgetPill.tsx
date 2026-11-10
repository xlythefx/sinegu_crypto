import { Wallet } from 'lucide-react'
import { fmtBudget } from '../../../lib/creatives'
import type { CreativeBudget } from '../../../types/creatives'

/** "$72.40 left of $100.00" beside the tabs — the budget is always in view while generating. */
export default function BudgetPill({ budget, onOpen }: { budget: CreativeBudget; onOpen: () => void }) {
  const low = budget.cap_usd <= 0 || budget.remaining_usd < budget.cap_usd * 0.1
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Open the Budget tab"
      className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-pill border px-3.5 text-[12px] font-semibold transition-colors duration-150 ${
        low
          ? 'border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] text-red'
          : 'border-border bg-surface text-muted hover:border-accent-line hover:text-text'
      }`}
    >
      <Wallet size={14} aria-hidden="true" className="flex-none" />
      <span>
        <strong className="font-bold text-text">{fmtBudget(budget.remaining_usd)}</strong> left of{' '}
        {fmtBudget(budget.cap_usd)} this month
      </span>
    </button>
  )
}
