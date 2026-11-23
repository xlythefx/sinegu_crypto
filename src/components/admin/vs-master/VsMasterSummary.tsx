import { Crown, Radio, Scale, Trophy } from 'lucide-react'
import type { ReactNode } from 'react'
import PnlBreakdown from '../../ui/PnlBreakdown'
import { fmtSignedMoney, fmtSignedPct } from '../../../lib/format'
import { fmtGap, type VsSummary } from '../../../lib/vsMaster'
import type { VsMasterData } from '../../../types/vsMaster'

const tone = (n: number | null | undefined) =>
  n === null || n === undefined || n === 0 ? 'text-text' : n > 0 ? 'text-green' : 'text-red'

function Tile({
  icon: Icon,
  label,
  value,
  sub,
  delay,
  highlight = false,
}: {
  icon: typeof Crown
  label: string
  value: ReactNode
  sub: ReactNode
  delay: number
  highlight?: boolean
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-1.5 rounded-card border p-4 ${
        highlight
          ? 'border-accent-line bg-[linear-gradient(to_bottom_right,var(--accentSoft),var(--surface))]'
          : 'border-border bg-surface'
      }`}
      data-aos="fade-up"
      data-aos-delay={delay}
    >
      <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">
        <Icon size={14} className="text-accent" />
        {label}
      </div>
      <div className="font-mono text-[22px] font-extrabold leading-tight">{value}</div>
      <div className="text-[12px] text-muted">{sub}</div>
    </div>
  )
}

/** The four headline tiles: the master's result, then how the customers stand against it. */
export default function VsMasterSummary({ data, summary }: { data: VsMasterData; summary: VsSummary }) {
  const m = data.master
  return (
    <div className="mb-4 grid grid-cols-4 gap-3 max-[1100px]:grid-cols-2 max-[480px]:grid-cols-1">
      <Tile
        icon={Crown}
        label="Master"
        highlight
        delay={0}
        value={
          m ? (
            <span className={tone(m.pct)}>{m.pct === null ? '—' : fmtSignedPct(m.pct, 2)}</span>
          ) : (
            <span className="text-muted">No master</span>
          )
        }
        sub={
          m ? (
            <>
              <PnlBreakdown gross={m.pnl_gross} net={m.pnl}>
                <span className={tone(m.pnl)}>{fmtSignedMoney(m.pnl)}</span>
              </PnlBreakdown>{' '}
              after fees · {m.trades} trades
              {m.win_rate !== null && ` · ${m.win_rate.toFixed(0)}% won`}
            </>
          ) : (
            'The master has no real-money account on this exchange.'
          )
        }
      />
      <Tile
        icon={Trophy}
        label="Ahead of master"
        delay={60}
        value={
          <>
            {summary.ahead}
            <span className="text-[14px] font-bold text-muted"> of {summary.compared}</span>
          </>
        }
        sub={
          summary.best ? (
            <>
              Best: <b className="text-text">{summary.best.name}</b>{' '}
              <span className={tone(summary.best.gap)}>{fmtGap(summary.best.gap ?? 0)}</span>
            </>
          ) : (
            'Customers who matched or beat the master’s return'
          )
        }
      />
      <Tile
        icon={Scale}
        label="Average gap"
        delay={120}
        value={
          summary.avgGap === null ? (
            <span className="text-muted">—</span>
          ) : (
            <span className={tone(summary.avgGap)}>{fmtGap(summary.avgGap)}</span>
          )
        }
        sub={
          summary.medianGap === null
            ? 'Customer return minus the master’s'
            : `Median ${fmtGap(summary.medianGap)} · customer return minus the master’s`
        }
      />
      <Tile
        icon={Radio}
        label="Master trades followed"
        delay={180}
        value={summary.followRate === null ? <span className="text-muted">—</span> : `${summary.followRate.toFixed(0)}%`}
        sub={
          summary.missed > 0
            ? `${summary.missed} master ${summary.missed === 1 ? 'close' : 'closes'} missed by a customer`
            : 'Every customer took every master trade'
        }
      />
    </div>
  )
}
