import { useState } from 'react'
import { useApiData } from '../../hooks/useApiData'
import { getTrackRecord } from '../../services/publicStats'
import { displaySymbol } from '../../lib/chart'
import { fmtMediumDate } from '../../lib/format'
import {
  CHART_MODES,
  LANDING_TRACK_RECORD_SYMBOLS,
  statCards,
  type ChartMode,
} from '../../lib/trackRecord'
import { SECTION_IDS } from '../../lib/scroll'
import TrackRecordChart from './TrackRecordChart'

const fetchLandingRecord = () => getTrackRecord(LANDING_TRACK_RECORD_SYMBOLS)

const CONTAINER = 'max-w-[1280px] mx-auto px-10 max-[560px]:px-5'
const SECTION_TITLE =
  'font-display text-[38px] font-extrabold tracking-[-0.02em] mb-2.5'
const SECTION_SUB = 'text-[17px] text-muted max-w-[560px] mx-auto'

const TONE: Record<string, string> = {
  green: 'text-green',
  accent: 'text-accent',
  red: 'text-red',
}

const TAB_BASE = 'text-center py-[11px] rounded-btn text-sm cursor-pointer transition-colors'
const TAB_ON = 'bg-surface border border-border font-bold text-text'
const TAB_OFF =
  'font-semibold text-muted border border-transparent bg-transparent hover:text-text'

/**
 * "See every trade, verified" — the master account's live track record, read
 * from the public (unauthenticated) `/public/track-record` endpoint, narrowed
 * to `LANDING_TRACK_RECORD_SYMBOLS`.
 *
 * Percentages only, by design: the endpoint publishes returns and counts and
 * never a balance, so nothing here can leak the account's size. The scope is
 * labelled from the API's echo of the filter, not from the constant: what the
 * page says it shows is what the numbers were computed from.
 */
export default function Performance() {
  const { data, loading, error } = useApiData(fetchLandingRecord)
  const [mode, setMode] = useState<ChartMode>('cumulative')

  const stats = data?.stats ?? null
  const series = data?.series ?? []
  const cards = statCards(stats)
  /** "LTC/USDT" — or null when the record covers every trade. */
  const scope = data?.symbols.length ? data.symbols.map(displaySymbol).join(', ') : null

  const placeholder = loading
    ? 'Loading the verified track record…'
    : error
      ? 'Live performance is momentarily unavailable.'
      : 'The track record publishes as soon as the first trades close.'

  const footnote =
    stats && series.length > 0
      ? `Verified from ${stats.trades.toLocaleString('en-US')} closed ${scope ? `${scope} ` : ''}trades over ${stats.trading_days} trading days · ${fmtMediumDate(stats.first_trade_at)} – ${fmtMediumDate(stats.last_trade_at)}`
      : null

  return (
    <section
      id={SECTION_IDS.performance}
      data-aos="fade-up"
      className={`${CONTAINER} scroll-mt-6 pt-[60px] pb-[76px]`}
    >
      <div className="text-center mb-9">
        <h2 className={SECTION_TITLE}>See every trade, verified</h2>
        <p className={SECTION_SUB}>
          {scope
            ? `Full, real-time performance analytics for the ${scope} strategy — the same numbers we're paid on.`
            : "Full, real-time performance analytics for every strategy — the same numbers we're paid on."}
        </p>
      </div>
      {/* Six cards, and every breakpoint divides into six exactly (6 / 3 / 2 / 1)
          so none is ever orphaned alone on a trailing row. The step down happens
          at 1200px rather than 1100 because six columns of a 26px figure get
          cramped before three columns do. */}
      <div className="grid grid-cols-6 gap-3.5 mb-5 max-[1200px]:grid-cols-3 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
        {cards.map((card) => (
          <div
            className="bg-surface border border-border rounded-card p-card"
            key={card.label}
          >
            <div className="text-xs text-muted font-semibold mb-3">
              {card.label}
            </div>
            <div
              className={`font-display text-[26px] font-extrabold${card.tone ? ` ${TONE[card.tone]}` : ''}${loading ? ' opacity-40' : ''}`}
            >
              {card.value}
            </div>
            <div className="text-[11px] text-faint mt-1">{card.hint}</div>
          </div>
        ))}
      </div>
      <div className="bg-surface border border-border rounded-[22px] pt-7 px-[30px] pb-6 shadow-[0_30px_80px_rgba(0,0,0,0.14)] max-[560px]:px-4">
        <div className="flex items-start justify-between mb-[22px] flex-wrap gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-[42px] h-[42px] rounded-xl bg-accent-soft border border-accent-line flex items-center justify-center text-accent text-xl shrink-0">
              ↗
            </div>
            <div>
              <div className="font-display text-[22px] font-extrabold">
                Performance Analytics
              </div>
              <div className="text-[13px] text-muted mt-0.5">
                Real-time profit and loss tracking, straight from the master
                account
              </div>
            </div>
          </div>
          {scope && (
            <span className="inline-flex items-center gap-2 self-center rounded-pill border border-accent-line bg-accent-soft px-3.5 py-1.5 font-mono text-[11.5px] font-semibold tracking-[0.4px] text-accent">
              <span className="h-[6px] w-[6px] rounded-full bg-accent" />
              {scope}
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1 bg-surface2 border border-hair rounded-xl p-[5px] mb-6">
          {CHART_MODES.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              aria-pressed={mode === tab.id}
              className={`${TAB_BASE} ${mode === tab.id ? TAB_ON : TAB_OFF}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {/* Re-mounted per mode so the curve redraws instead of hard-cutting. */}
        <div key={mode} className="animate-[fadeup_0.35s_ease-out]">
          <TrackRecordChart
            series={series}
            mode={mode}
            placeholder={placeholder}
          />
          {/* The views are not on one denominator (see CHART_MODES), so each
              names its own — a −13% day beside a −2% dip on the cumulative
              curve is two measures, not a mistake. */}
          {series.length > 0 && (
            <p className="text-[11.5px] text-muted mt-4 text-center">
              {CHART_MODES.find((tab) => tab.id === mode)?.note}
            </p>
          )}
        </div>
        {footnote && (
          <p className="text-[11.5px] text-faint mt-1.5 text-center">{footnote}</p>
        )}
      </div>
    </section>
  )
}
