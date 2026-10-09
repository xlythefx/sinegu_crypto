import type { ReactNode } from 'react'
import { Activity, CheckCircle2, SkipForward, XCircle } from 'lucide-react'
import { plural } from '../../../lib/signalHealth'
import type { TradeLogSummary } from '../../../types/tradeLogs'

const STAT_ICON =
  'w-10 h-10 flex-shrink-0 grid place-items-center rounded-[11px] bg-surface2 border border-border'

/**
 * The list's four totals. The normal / problem split under the last two is
 * counted over the signals the SIGNAL filters select, so it is shown only
 * while no account filter is on — under one, the cards above sum the matched
 * signals and the split would describe a different set.
 */
export default function SignalStats({
  summary,
  showSplit,
}: {
  summary: TradeLogSummary | null
  showSplit: boolean
}) {
  const split = showSplit && summary !== null

  return (
    <div
      className="grid grid-cols-4 gap-[14px] mb-[18px] max-[900px]:grid-cols-2 max-[520px]:grid-cols-1"
      data-aos="fade-up"
    >
      <StatCard icon={<Activity size={18} />} label="Signals" value={summary?.signals ?? null} />
      <StatCard
        icon={<CheckCircle2 size={18} />}
        tone="text-green"
        label="Orders filled"
        value={summary?.filled ?? null}
      />
      <StatCard
        icon={<SkipForward size={18} />}
        tone="text-muted"
        label="Accounts skipped"
        value={summary?.skipped ?? null}
        sub={split ? `${summary.normalSkips} normal` : undefined}
      />
      <StatCard
        icon={<XCircle size={18} />}
        tone={summary && summary.failed > 0 ? 'text-red' : 'text-muted'}
        label="Accounts failed"
        value={summary?.failed ?? null}
        sub={
          split
            ? summary.problemAccounts > 0
              ? `${plural(summary.problemAccounts, 'problem', 'problems')} in total`
              : 'No problems'
            : undefined
        }
        subTone={split && summary.problemAccounts > 0 ? 'text-red' : 'text-faint'}
      />
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  tone = 'text-muted',
  sub,
  subTone = 'text-faint',
}: {
  icon: ReactNode
  label: string
  value: number | null
  tone?: string
  sub?: string
  subTone?: string
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-card flex items-center gap-[13px]">
      <span className={`${STAT_ICON} ${tone}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[10.5px] uppercase tracking-[0.07em] text-faint mb-[3px]">{label}</p>
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[19px] font-bold text-text leading-[1.1] font-mono">
            {value ?? '—'}
          </span>
          {sub && <span className={`text-[12px] font-semibold ${subTone}`}>{sub}</span>}
        </p>
      </div>
    </div>
  )
}
