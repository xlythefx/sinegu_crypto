import { useState } from 'react'
import { fmtMediumDate, fmtSignedPct } from '../../lib/format'
import { CHART_MODES, type ChartMode } from '../../lib/trackRecord'
import type { TrackRecord } from '../../types/publicStats'
import TrackRecordChart from '../landing/TrackRecordChart'
import { CONTAINER, H2, LANDING_IDS, LEAD } from './layout'

interface TrackRecordNextProps {
  record: TrackRecord | null
  loading: boolean
  error: unknown
}

/**
 * The published record, trimmed from six stat cards to the three a visitor
 * can read without a glossary, beside the same chart the old page drew.
 * Scope: the record is narrowed to the strategy the page sells
 * (`LANDING_TRACK_RECORD_SYMBOLS`) and, by the owner's call (2026-09-23), the
 * copy neither names that scope nor claims "every trade" — it says "our own
 * account's results", which is true either way.
 */
export default function TrackRecordNext({ record, loading, error }: TrackRecordNextProps) {
  const [mode, setMode] = useState<ChartMode>('cumulative')
  const stats = record?.stats ?? null
  const series = record?.series ?? []

  const figures = stats
    ? [
        ...(stats.return_on_capital_pct == null
          ? []
          : [{
              value: fmtSignedPct(stats.return_on_capital_pct, 2),
              text: 'Return on Capital: profit on everything invested so far',
              tone: stats.return_on_capital_pct < 0 ? 'text-red' : 'text-green',
            }]),
        { value: `${stats.winning_days} of ${stats.trading_days}`, text: 'trading days ended in profit', tone: 'text-text' },
        { value: stats.trades.toLocaleString('en-US'), text: `trades closed since ${fmtMediumDate(stats.first_trade_at)}`, tone: 'text-text' },
      ]
    : []

  const placeholder = loading
    ? 'Loading the track record…'
    : error
      ? 'The track record is momentarily unavailable.'
      : 'The track record publishes as soon as the first trades close.'

  return (
    <section id={LANDING_IDS.record} className="scroll-mt-6 border-t border-hair">
      <div className={`${CONTAINER} py-20 max-[560px]:py-14`}>
        <div className="flex items-end justify-between gap-10 flex-wrap mb-10" data-aos="fade-up">
          <div className="max-w-[620px]">
            <h2 className={`${H2} mb-4`}>The record so far</h2>
            <p className={LEAD}>
              Our own account&rsquo;s results with the strategy, updated as
              trades close. We publish percentages, never amounts.
            </p>
          </div>
          {figures.length > 0 && (
            <dl className="flex gap-10 flex-wrap max-[560px]:gap-6">
              {figures.map((f) => (
                // dt before dd (the dl content model); the figure is shown first.
                <div key={f.text} className="max-w-[180px] flex flex-col-reverse justify-end">
                  <dt className="text-[13px] leading-[1.45] text-muted mt-2">{f.text}</dt>
                  <dd className={`font-display text-[30px] font-extrabold leading-none ${f.tone} ${loading ? 'opacity-40' : ''}`}>{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="bg-surface border border-border rounded-card pt-6 px-6 pb-5 max-[560px]:px-3" data-aos="fade-up" data-aos-delay={80}>
          <div role="group" aria-label="Chart view" className="inline-flex gap-1 bg-surface2 border border-hair rounded-btn p-1 mb-6 max-[560px]:flex max-[560px]:w-full">
            {CHART_MODES.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                aria-pressed={mode === tab.id}
                className={`min-h-10 px-4 rounded-[6px] text-[13.5px] whitespace-nowrap cursor-pointer transition-colors duration-200 max-[560px]:flex-1 max-[560px]:px-1.5 max-[560px]:text-[12px] ${
                  mode === tab.id
                    ? 'bg-surface border border-border font-bold text-text'
                    : 'border border-transparent font-semibold text-muted hover:text-text'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* Re-mounted per view so the curve redraws instead of hard-cutting. */}
          <div key={mode} className="animate-[fadeup_0.35s_ease-out]">
            <TrackRecordChart series={series} mode={mode} placeholder={placeholder} />
            {series.length > 0 && (
              <p className="text-[12px] text-muted mt-4">{CHART_MODES.find((t) => t.id === mode)?.note}</p>
            )}
          </div>
          {stats && series.length > 0 && (
            <p className="text-[12px] text-faint mt-1.5">
              {stats.trades.toLocaleString('en-US')} closed trades over {stats.trading_days} trading days,{' '}
              {fmtMediumDate(stats.first_trade_at)} to {fmtMediumDate(stats.last_trade_at)}.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
