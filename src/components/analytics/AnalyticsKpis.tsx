import { ArrowDown, ArrowUp, Award, LineChart, TrendingDown } from 'lucide-react'
import { fmtSignedMoney } from '../../lib/format'
import ReturnFlipCard from './ReturnFlipCard'
import type { DayExtreme, ReturnOnDeposit } from '../../types/analytics'

interface AnalyticsKpisProps {
  totalReturnPct: number | null
  totalReturnAbs: number
  returnOnDeposit: ReturnOnDeposit
  /** True when a symbol / strategy chip is active. */
  filtered: boolean
  avgDailyPnl: number | null
  tradingDays: number
  bestDay: DayExtreme | null
  worstDay: DayExtreme | null
}

/** The four analytics KPI cards: the flippable Total Return / Return on
 *  Deposit card, Avg Daily P&L, Best Day and Worst Day. */
export default function AnalyticsKpis({
  totalReturnPct,
  totalReturnAbs,
  returnOnDeposit,
  filtered,
  avgDailyPnl,
  tradingDays,
  bestDay,
  worstDay,
}: AnalyticsKpisProps) {
  return (
    <div
      className="grid grid-cols-[repeat(auto-fit,minmax(215px,1fr))] gap-stack items-stretch"
      data-aos="fade-up"
      data-aos-delay="200"
    >
      <ReturnFlipCard
        totalReturnPct={totalReturnPct}
        totalReturnAbs={totalReturnAbs}
        returnOnDeposit={returnOnDeposit}
        filtered={filtered}
      />

      <div className="rounded-card p-card border border-border bg-surface flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2.5 mb-1">
          <span className="inline-flex items-center gap-[5px] text-[10.5px] font-extrabold tracking-[0.5px] text-faint uppercase pt-[5px]">
            Avg Daily P&L
          </span>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
            <LineChart size={16} />
          </span>
        </div>
        <div
          className={`font-mono text-[27px] font-extrabold tracking-[-0.6px] ${(avgDailyPnl ?? 0) < 0 ? 'text-red' : 'text-accent'}`}
        >
          {avgDailyPnl === null ? '—' : fmtSignedMoney(avgDailyPnl)}
        </div>
        <div className="text-[11.5px] font-semibold text-muted">
          {tradingDays} trading days
        </div>
      </div>

      <div className="rounded-card p-card border border-border bg-surface flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2.5 mb-1">
          <span className="inline-flex items-center gap-[5px] text-[10.5px] font-extrabold tracking-[0.5px] text-faint uppercase pt-[5px]">
            Best Day <ArrowUp size={13} className="text-green" />
          </span>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border text-green bg-[rgba(47,214,122,0.1)] border-[rgba(47,214,122,0.3)]">
            <Award size={16} />
          </span>
        </div>
        <div
          className={`font-mono text-[27px] font-extrabold tracking-[-0.6px] ${bestDay && bestDay.pnl < 0 ? 'text-red' : 'text-green'}`}
        >
          {bestDay ? fmtSignedMoney(bestDay.pnl) : '—'}
        </div>
        <div className="text-[11.5px] font-semibold text-muted">
          Largest single day gain
        </div>
      </div>

      <div className="rounded-card p-card border border-border bg-surface flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2.5 mb-1">
          <span className="inline-flex items-center gap-[5px] text-[10.5px] font-extrabold tracking-[0.5px] text-faint uppercase pt-[5px]">
            Worst Day <ArrowDown size={13} className="text-red" />
          </span>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border text-red bg-[rgba(255,90,90,0.1)] border-[rgba(255,90,90,0.3)]">
            <TrendingDown size={16} />
          </span>
        </div>
        <div
          className={`font-mono text-[27px] font-extrabold tracking-[-0.6px] ${worstDay && worstDay.pnl >= 0 ? 'text-green' : 'text-red'}`}
        >
          {worstDay ? fmtSignedMoney(worstDay.pnl) : '—'}
        </div>
        <div className="text-[11.5px] font-semibold text-muted">
          Largest single day loss
        </div>
      </div>
    </div>
  )
}
