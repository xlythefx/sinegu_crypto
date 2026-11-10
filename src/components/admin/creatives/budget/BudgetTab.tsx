import { useEffect, useState } from 'react'
import { Lock, Pencil, Users, Wallet } from 'lucide-react'
import { useApiData } from '../../../../hooks/useApiData'
import { fmtDateTime, fmtLongMonth } from '../../../../lib/format'
import { fmtBudget } from '../../../../lib/creatives'
import { getCreativeBudget } from '../../../../services/creatives'
import type { CreativeBudget } from '../../../../types/creatives'
import { BTN_GHOST } from '../../../settings/formClasses'
import SectionHeader from '../SectionHeader'
import { SECTION } from '../creativeClasses'
import BudgetCapModal from './BudgetCapModal'

interface BudgetTabProps {
  budget: CreativeBudget
  onBudget: (budget: CreativeBudget) => void
  /** Full admins only; collaborators see the cap read-only. */
  canEdit: boolean
}

/** Spent this close to the cap turns the bar red. */
const WARN_SHARE = 0.9

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="min-w-0 rounded-row border border-border bg-surface2 px-3.5 py-3">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">{label}</p>
      <p className="mt-1 font-display text-[20px] font-extrabold text-text">{value}</p>
      <p className="mt-0.5 text-[11.5px] leading-[1.45] text-muted">{hint}</p>
    </div>
  )
}

/**
 * This month's Higgsfield spend against the cap, and who spent it. A
 * generation's price is reserved the moment it starts and given back if it
 * fails, is blocked or is cancelled, so "spent" already includes what is
 * still generating — the cap can never be overrun by two people at once.
 */
export default function BudgetTab({ budget, onBudget, canEdit }: BudgetTabProps) {
  const { data } = useApiData(getCreativeBudget)
  const [editing, setEditing] = useState(false)

  // The page's figure may be minutes old; the fresh read replaces it.
  useEffect(() => {
    if (data) onBudget(data)
  }, [data, onBudget])

  const cap = budget.cap_usd
  const share = cap > 0 ? Math.min(1, budget.spent_usd / cap) : 1
  // A $0 cap draws a full, solid red bar: generating is off.
  const settledShare = cap > 0 ? Math.min(share, Math.max(0, budget.spent_usd - budget.reserved_usd) / cap) : 1
  const warn = cap <= 0 || share >= WARN_SHARE
  const people = [...budget.by_person].sort((a, b) => b.spent_usd - a.spent_usd)

  return (
    <div className="grid grid-cols-1 gap-stack xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start">
      <section className={SECTION} data-aos="fade-up" aria-labelledby="creatives-budget">
        <SectionHeader
          icon={Wallet}
          id="creatives-budget"
          title={`${fmtLongMonth(budget.month)} budget`}
          subtitle="A calendar month in UTC. Each price is reserved when a generation starts; failed, blocked and cancelled ones are given back."
          actions={
            canEdit ? (
              <button type="button" className={`${BTN_GHOST} max-sm:w-full`} onClick={() => setEditing(true)}>
                <Pencil size={14} aria-hidden="true" />
                Change cap
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted">
                <Lock size={13} aria-hidden="true" />
                Only a full admin can change the cap
              </span>
            )
          }
        />

        <div>
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-display text-[30px] font-extrabold leading-none text-text">
              {fmtBudget(budget.spent_usd)}
            </span>
            <span className="text-[13.5px] text-muted">spent of {fmtBudget(cap)}</span>
          </p>
          <div
            className="mt-3.5 h-3 w-full overflow-hidden rounded-pill border border-hair bg-surface2"
            role="progressbar"
            aria-label="Spent this month"
            aria-valuemin={0}
            aria-valuemax={cap}
            aria-valuenow={Math.min(budget.spent_usd, cap)}
          >
            <div className="flex h-full" style={{ width: `${share * 100}%` }}>
              <div className={`h-full ${warn ? 'bg-red' : 'bg-accent'}`} style={{ width: share > 0 ? `${(settledShare / share) * 100}%` : 0 }} />
              <div className={`h-full flex-1 ${warn ? 'bg-red/45' : 'bg-accent/45'}`} />
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${warn ? 'bg-red' : 'bg-accent'}`} aria-hidden="true" />
              Finished
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${warn ? 'bg-red/45' : 'bg-accent/45'}`} aria-hidden="true" />
              Still generating (reserved)
            </span>
          </div>
        </div>

        {cap <= 0 && (
          <p className="rounded-field border border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] px-3 py-2.5 text-[12.5px] font-semibold leading-[1.5] text-red">
            The cap is $0, so generating is switched off for everyone.{' '}
            {canEdit ? 'Raise it to switch it back on.' : 'A full admin can raise it.'}
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Tile label="Left" value={fmtBudget(budget.remaining_usd)} hint="What can still be spent this month." />
          <Tile label="Reserved" value={fmtBudget(budget.reserved_usd)} hint="Still generating — given back if it fails." />
          <Tile
            label="Generations"
            value={budget.generations.toLocaleString()}
            hint="Started this month."
          />
        </div>

        <p className="border-t border-hair pt-3.5 text-[12px] leading-[1.5] text-muted">
          {budget.updated_by_name && budget.updated_at
            ? `Cap last changed by ${budget.updated_by_name} on ${fmtDateTime(budget.updated_at)}.`
            : budget.updated_at
              ? `Cap last changed on ${fmtDateTime(budget.updated_at)}.`
              : 'Nobody has changed the cap yet — it is the starting amount.'}
        </p>
      </section>

      <section className={SECTION} data-aos="fade-up" data-aos-delay={60} aria-labelledby="creatives-people">
        <SectionHeader
          icon={Users}
          id="creatives-people"
          title="Who spent it"
          subtitle="This month, most first."
        />
        {people.length === 0 ? (
          <p className="rounded-row border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted">
            Nobody has generated anything this month yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {people.map((p, i) => {
              const pct = budget.spent_usd > 0 ? (p.spent_usd / budget.spent_usd) * 100 : 0
              return (
                <li
                  key={p.uni_id ?? `unknown-${i}`}
                  className="flex min-w-0 flex-col gap-2 rounded-row border border-border bg-surface2 px-3.5 py-3"
                >
                  <div className="flex min-w-0 items-baseline gap-3">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-text">
                      {p.name ?? 'Someone no longer listed'}
                    </span>
                    <span className="font-mono text-[12.5px] font-semibold text-text">{fmtBudget(p.spent_usd)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-pill bg-surface">
                      <div className="h-full rounded-pill bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="flex-none font-mono text-[11px] text-faint">
                      {p.generations === 1 ? '1 generation' : `${p.generations} generations`}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {canEdit && (
        <BudgetCapModal open={editing} budget={budget} onClose={() => setEditing(false)} onSaved={onBudget} />
      )}
    </div>
  )
}
