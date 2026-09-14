import { ArrowDown, ArrowUp, Award, LineChart, Receipt, TrendingDown } from 'lucide-react'
import { fmtMediumDate, fmtMoney, fmtSignedMoney } from '../../lib/format'
import ReturnFlipCard from './ReturnFlipCard'
import PnlBreakdown from '../ui/PnlBreakdown'
import type { DayExtreme, ReturnOnDeposit } from '../../types/analytics'
import type { FeeSummary } from '../../types/dashboard'

interface AnalyticsKpisProps {
  totalReturnPct: number | null
  /** Before fees. */
  totalReturnAbs: number
  totalReturnAbsNet: number
  returnOnDeposit: ReturnOnDeposit
  /** True when a symbol / strategy chip is active. */
  filtered: boolean
  avgDailyPnl: number | null
  avgDailyPnlNet: number | null
  tradingDays: number
  bestDay: DayExtreme | null
  worstDay: DayExtreme | null
  fees: FeeSummary
}

const CARD = 'rounded-card p-card border border-border bg-surface flex flex-col gap-2'
const LABEL =
  'inline-flex items-center gap-[5px] text-[10.5px] font-extrabold tracking-[0.5px] text-faint uppercase pt-[5px]'
const VALUE = 'font-mono text-[27px] font-extrabold tracking-[-0.6px]'
const SUB = 'text-[11.5px] font-semibold text-muted'

/** The analytics KPI cards: the flippable Total Return / Return on Deposit
 *  card, Avg Daily P&L, Best Day, Worst Day — all BEFORE exchange fees, each
 *  money figure showing its after-fees twin on hover — and Exchange Fees,
 *  the cost of running the strategy as a number of its own. */
export default function AnalyticsKpis({
  totalReturnPct,
  totalReturnAbs,
  totalReturnAbsNet,
  returnOnDeposit,
  filtered,
  avgDailyPnl,
  avgDailyPnlNet,
  tradingDays,
  bestDay,
  worstDay,
  fees,
}: AnalyticsKpisProps) {
  const feesSince = fees.trades_without_fee > 0 ? fees.since : null

  return (
    <div
      className="grid grid-cols-[repeat(auto-fit,minmax(215px,1fr))] gap-stack items-stretch"
      data-aos="fade-up"
      data-aos-delay="200"
    >
      <ReturnFlipCard
        totalReturnPct={totalReturnPct}
        totalReturnAbs={totalReturnAbs}
        totalReturnAbsNet={totalReturnAbsNet}
        returnOnDeposit={returnOnDeposit}
        filtered={filtered}
        feesSince={feesSince}
      />

      <div className={CARD}>
        <div className="flex items-start justify-between gap-2.5 mb-1">
          <span className={LABEL}>Avg Daily P&L</span>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
            <LineChart size={16} />
          </span>
        </div>
        <div className={`${VALUE} ${(avgDailyPnl ?? 0) < 0 ? 'text-red' : 'text-accent'}`}>
          {avgDailyPnl === null || avgDailyPnlNet === null ? (
            '—'
          ) : (
            <PnlBreakdown gross={avgDailyPnl} net={avgDailyPnlNet} feesSince={feesSince} heading="Per trading day">
              {fmtSignedMoney(avgDailyPnl)}
            </PnlBreakdown>
          )}
        </div>
        <div className={SUB}>{tradingDays} trading days · before fees</div>
      </div>

      <div className={CARD}>
        <div className="flex items-start justify-between gap-2.5 mb-1">
          <span className={LABEL}>
            Best Day <ArrowUp size={13} className="text-green" />
          </span>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border text-green bg-[rgba(47,214,122,0.1)] border-[rgba(47,214,122,0.3)]">
            <Award size={16} />
          </span>
        </div>
        <div className={`${VALUE} ${bestDay && bestDay.pnl < 0 ? 'text-red' : 'text-green'}`}>
          {bestDay ? (
            <PnlBreakdown gross={bestDay.pnl} net={bestDay.pnl_net} heading={fmtMediumDate(bestDay.date)}>
              {fmtSignedMoney(bestDay.pnl)}
            </PnlBreakdown>
          ) : (
            '—'
          )}
        </div>
        <div className={SUB}>
          {bestDay ? `${fmtMediumDate(bestDay.date)} · before fees` : 'Largest single day gain'}
        </div>
      </div>

      <div className={CARD}>
        <div className="flex items-start justify-between gap-2.5 mb-1">
          <span className={LABEL}>
            Worst Day <ArrowDown size={13} className="text-red" />
          </span>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border text-red bg-[rgba(255,90,90,0.1)] border-[rgba(255,90,90,0.3)]">
            <TrendingDown size={16} />
          </span>
        </div>
        <div className={`${VALUE} ${worstDay && worstDay.pnl >= 0 ? 'text-green' : 'text-red'}`}>
          {worstDay ? (
            <PnlBreakdown gross={worstDay.pnl} net={worstDay.pnl_net} heading={fmtMediumDate(worstDay.date)}>
              {fmtSignedMoney(worstDay.pnl)}
            </PnlBreakdown>
          ) : (
            '—'
          )}
        </div>
        <div className={SUB}>
          {worstDay ? `${fmtMediumDate(worstDay.date)} · before fees` : 'Largest single day loss'}
        </div>
      </div>

      {/* What the exchange took: commission on every fill plus funding while
          positions were held. Its own card because a cost that only ever
          appears as the gap between two other numbers is never seen. */}
      <div className={CARD}>
        <div className="flex items-start justify-between gap-2.5 mb-1">
          <span className={LABEL}>Exchange Fees</span>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-border bg-surface2 text-muted">
            <Receipt size={16} />
          </span>
        </div>
        <div className={`${VALUE} text-text`}>
          {fees.total === 0 ? '$0.00' : `−${fmtMoney(fees.total)}`}
        </div>
        <div className={SUB}>
          Commission + funding · {fees.trades_with_fee.toLocaleString('en-US')} trade
          {fees.trades_with_fee === 1 ? '' : 's'}
        </div>
        {fees.trades_without_fee > 0 && (
          <div className="text-[10.5px] text-faint font-semibold leading-[1.45]">
            Recorded from {fmtMediumDate(fees.since)} — {fees.trades_without_fee.toLocaleString('en-US')}{' '}
            earlier trade{fees.trades_without_fee === 1 ? '' : 's'} show the same figure before and after.
          </div>
        )}
      </div>
    </div>
  )
}
