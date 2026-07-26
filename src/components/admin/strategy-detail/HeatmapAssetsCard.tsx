import { useMemo, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Trophy, TrendingDown, TrendingUp } from 'lucide-react'
import SignedBars from './SignedBars'
import { fmtMoney, fmtSignedMoney } from '../../../lib/format'
import type { StrategyDetailStats } from '../../../lib/strategyStats'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const CARD = 'rounded-card border border-border bg-surface p-card'
const CHIP =
  'w-7 h-7 rounded-[9px] bg-accent-soft border border-accent-line grid place-items-center text-accent flex-none'
const CARD_TITLE = 'font-display text-[15px] font-extrabold'
const CARD_SUB = 'text-[12px] text-muted mt-px'
const PANEL_LABEL =
  'flex items-center gap-1.5 mb-2.5 font-mono text-[10px] font-semibold tracking-[0.12em] uppercase text-faint'
const EMPTY =
  'py-[30px] px-4 border border-dashed border-border rounded-row bg-surface2 text-center text-[13px] text-muted'
const ICON_BTN =
  'grid place-items-center w-[30px] h-[30px] border border-border rounded-btn bg-surface text-muted cursor-pointer transition-colors enabled:hover:bg-accent-soft enabled:hover:text-accent enabled:hover:border-accent-line disabled:opacity-45 disabled:cursor-not-allowed'
const SWATCH = 'w-[9px] h-[9px] rounded-[3px] flex-none'

/* heat colour scale — z neutral, p1-4 profit, n1-4 loss */
const HEAT: Record<string, string> = {
  z: 'bg-surface2 text-faint',
  p1: 'bg-[color-mix(in_srgb,var(--green)_22%,transparent)] text-text',
  p2: 'bg-[color-mix(in_srgb,var(--green)_42%,transparent)] text-text',
  p3: 'bg-[color-mix(in_srgb,var(--green)_68%,transparent)] text-[#052e16]',
  p4: 'bg-green text-[#052e16]',
  n1: 'bg-[color-mix(in_srgb,var(--red)_22%,transparent)] text-text',
  n2: 'bg-[color-mix(in_srgb,var(--red)_42%,transparent)] text-text',
  n3: 'bg-[color-mix(in_srgb,var(--red)_68%,transparent)] text-white',
  n4: 'bg-red text-white',
}

const CAL_CELL =
  'aspect-square rounded-[7px] flex flex-col items-center justify-center gap-px transition-transform hover:scale-[1.08]'
const DOW_TILE =
  'w-full rounded-btn py-2 px-0.5 flex flex-col items-center gap-0.5'
const WL_ROW =
  'grid grid-cols-[1fr_auto_auto] items-center gap-2 w-full py-[7px] px-2.5 border-b border-hair bg-transparent text-text cursor-pointer text-[11.5px] text-left transition-colors last:border-b-0 hover:bg-surface2'
const WL_NAME =
  'flex items-center gap-1.5 font-bold min-w-0 overflow-hidden text-ellipsis whitespace-nowrap'
const WL_WR = 'text-faint min-w-[34px] text-right font-mono'
const ASSET_CARD =
  'text-left p-3.5 border border-border rounded-strip bg-surface cursor-pointer transition-[border-color,transform] hover:border-accent-line hover:-translate-y-0.5'
const STAT_CELL = 'py-1.5 px-1 rounded-btn bg-surface2 text-center'
const STAT_LABEL =
  'block text-[8.5px] font-bold tracking-[0.3px] uppercase text-faint'

/** Heat intensity bucket (0–4) → CSS class suffix, signed. */
function heatLevel(pnl: number, maxAbs: number): string {
  if (maxAbs === 0 || pnl === 0) return 'z'
  const t = Math.min(1, Math.abs(pnl) / maxAbs)
  const lvl = t > 0.75 ? 4 : t > 0.5 ? 3 : t > 0.25 ? 2 : 1
  return `${pnl > 0 ? 'p' : 'n'}${lvl}`
}

function compact(n: number): string {
  return Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toFixed(0)
}

interface Props {
  stats: StrategyDetailStats
  onOpenAsset: (ticker: string) => void
}

/** Daily P&L calendar heatmap + day-of-week strip + per-asset performance
 *  (bar chart, winners/losers tables, asset detail cards). */
export default function HeatmapAssetsCard({ stats, onOpenAsset }: Props) {
  const now = new Date()
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))

  const cells = useMemo(() => {
    const year = month.getFullYear()
    const m = month.getMonth()
    const firstDay = new Date(year, m, 1).getDay()
    const days = new Date(year, m + 1, 0).getDate()
    const out: ({ day: number; iso: string; pnl: number } | null)[] = []
    for (let i = 0; i < firstDay; i++) out.push(null)
    for (let d = 1; d <= days; d++) {
      const iso = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      out.push({ day: d, iso, pnl: stats.daily[iso] ?? 0 })
    }
    while (out.length % 7 !== 0) out.push(null)
    return out
  }, [month, stats.daily])

  const calMaxAbs = useMemo(
    () => Math.max(0, ...cells.filter(Boolean).map((c) => Math.abs(c!.pnl))),
    [cells],
  )
  const dowMaxAbs = Math.max(0, ...stats.dayOfWeek.map((d) => Math.abs(d.pnl)))

  const monthLabel = month.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
  const atCurrentMonth =
    month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth()

  const winners = stats.byAsset.filter((a) => a.totalPnl >= 0)
  const losers = [...stats.byAsset.filter((a) => a.totalPnl < 0)].reverse()
  const assetBars = stats.byAsset
    .slice(0, 8)
    .map((a) => ({ label: a.display, pnl: a.totalPnl }))

  return (
    <section className={CARD} data-aos="fade-up">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 mb-3.5">
          <span className={CHIP}>
            <Calendar size={16} />
          </span>
          <div>
            <div className={CARD_TITLE}>Heatmaps &amp; Asset Performance</div>
            <div className={CARD_SUB}>
              Daily P&L calendar · winners &amp; losers by instrument
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={ICON_BTN}
            aria-label="Previous month"
            onClick={() => setMonth((mo) => new Date(mo.getFullYear(), mo.getMonth() - 1, 1))}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[120px] text-center text-[13px] font-bold">
            {monthLabel}
          </span>
          <button
            type="button"
            className={ICON_BTN}
            aria-label="Next month"
            disabled={atCurrentMonth}
            onClick={() => setMonth((mo) => new Date(mo.getFullYear(), mo.getMonth() + 1, 1))}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 max-[1000px]:grid-cols-1">
        {/* LEFT: calendar */}
        <div>
          <p className={PANEL_LABEL}>
            <Calendar size={13} /> Daily P&L Heatmap
          </p>
          <div
            key={month.getTime()}
            className="grid grid-cols-7 gap-[5px] animate-[fadeup_0.35s_ease-out]"
          >
            {WEEKDAYS.map((wd) => (
              <div
                className="text-center text-[9.5px] font-bold tracking-[0.4px] uppercase text-faint pb-0.5"
                key={wd}
              >
                {wd}
              </div>
            ))}
            {cells.map((cell, i) =>
              cell === null ? (
                <div key={i} className="aspect-square" />
              ) : (
                <div
                  key={i}
                  className={`${CAL_CELL} ${HEAT[heatLevel(cell.pnl, calMaxAbs)]}`}
                  title={
                    cell.pnl !== 0
                      ? `${cell.iso}: ${fmtSignedMoney(cell.pnl)}`
                      : cell.iso
                  }
                >
                  <span className="text-[10px] font-semibold leading-none">
                    {cell.day}
                  </span>
                  {cell.pnl !== 0 && (
                    <span className="font-mono text-[8px] leading-none opacity-90">
                      {cell.pnl >= 0 ? '+' : '−'}
                      {compact(Math.abs(cell.pnl))}
                    </span>
                  )}
                </div>
              ),
            )}
          </div>
          <div className="flex items-center justify-end gap-1.5 mt-2.5 text-[10.5px] text-faint">
            <span className={`w-3 h-3 rounded-[3px] ${HEAT.n4}`} />
            <span className={`w-3 h-3 rounded-[3px] ${HEAT.n2}`} />
            <span className={`w-3 h-3 rounded-[3px] ${HEAT.z}`} />
            <span className={`w-3 h-3 rounded-[3px] ${HEAT.p2}`} />
            <span className={`w-3 h-3 rounded-[3px] ${HEAT.p4}`} />
            Loss → Neutral → Profit
          </div>

          {/* Day-of-week strip */}
          <p className={`${PANEL_LABEL} mt-[18px] pt-4 border-t border-hair`}>
            Best / worst days
          </p>
          <div className="grid grid-cols-7 gap-[5px]">
            {stats.dayOfWeek.map((d) => (
              <div className="flex flex-col items-center gap-[3px]" key={d.label}>
                <div
                  className={`${DOW_TILE} ${HEAT[d.trades > 0 ? heatLevel(d.pnl, dowMaxAbs) : 'z']}`}
                  title={`${d.label}: ${fmtSignedMoney(d.pnl)} · ${d.trades} trades`}
                >
                  <span className="text-[9px] font-extrabold leading-none">
                    {d.label}
                  </span>
                  {d.trades > 0 && (
                    <span className="font-mono text-[8px] leading-none opacity-90">
                      {d.pnl >= 0 ? '+' : '−'}
                      {compact(Math.abs(d.pnl))}
                    </span>
                  )}
                </div>
                {d.trades > 0 && (
                  <span className="text-[8px] text-faint font-mono">
                    {d.wins}W/{d.losses}L
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: asset performance */}
        <div className="flex flex-col">
          <p className={PANEL_LABEL}>
            <Trophy size={13} /> Asset Performance
          </p>
          {stats.byAsset.length === 0 ? (
            <div className={EMPTY}>No asset data available.</div>
          ) : (
            <>
              {stats.byAsset.length > 1 && <SignedBars data={assetBars} barMax={44} />}

              <div className="grid grid-cols-2 gap-3 mt-1.5 max-[560px]:grid-cols-1">
                {winners.length > 0 && (
                  <div>
                    <p className="flex items-center gap-[5px] mb-[7px] text-[10px] font-bold tracking-[0.4px] uppercase text-green">
                      <TrendingUp size={12} /> Winners ({winners.length})
                    </p>
                    <div className="border border-hair rounded-[11px] overflow-hidden">
                      {winners.map((a) => (
                        <button
                          type="button"
                          key={a.ticker}
                          className={WL_ROW}
                          onClick={() => onOpenAsset(a.ticker)}
                        >
                          <span className={WL_NAME}>
                            <span className={SWATCH} style={{ background: a.color }} />
                            {a.display}
                          </span>
                          <span className="font-mono font-bold text-green">
                            +{fmtMoney(a.totalPnl).slice(1)}
                          </span>
                          <span className={WL_WR}>{a.winrate.toFixed(0)}%</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {losers.length > 0 && (
                  <div>
                    <p className="flex items-center gap-[5px] mb-[7px] text-[10px] font-bold tracking-[0.4px] uppercase text-red">
                      <TrendingDown size={12} /> Losers ({losers.length})
                    </p>
                    <div className="border border-hair rounded-[11px] overflow-hidden">
                      {losers.map((a) => (
                        <button
                          type="button"
                          key={a.ticker}
                          className={WL_ROW}
                          onClick={() => onOpenAsset(a.ticker)}
                        >
                          <span className={WL_NAME}>
                            <span className={SWATCH} style={{ background: a.color }} />
                            {a.display}
                          </span>
                          <span className="font-mono font-bold text-red">
                            {fmtSignedMoney(a.totalPnl)}
                          </span>
                          <span className={WL_WR}>{a.winrate.toFixed(0)}%</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Asset detail cards */}
      {stats.byAsset.length > 0 && (
        <div className="mt-5 pt-[18px] border-t border-hair">
          <p className={PANEL_LABEL}>Asset Details</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
            {stats.byAsset.map((a) => (
              <button
                type="button"
                key={a.ticker}
                className={ASSET_CARD}
                onClick={() => onOpenAsset(a.ticker)}
              >
                <div className="flex items-center gap-[9px] mb-[11px]">
                  <span className={SWATCH} style={{ background: a.color }} />
                  <div className="flex flex-col min-w-0 flex-1">
                    <b className="text-[13px] font-extrabold">{a.display}</b>
                    <span className="text-[10.5px] text-faint">{a.trades} trades</span>
                  </div>
                  <span
                    className={`py-[3px] px-2 rounded-btn text-[11px] font-bold font-mono ${a.totalPnl >= 0 ? 'bg-[color-mix(in_srgb,var(--green)_14%,transparent)] text-green' : 'bg-[color-mix(in_srgb,var(--red)_14%,transparent)] text-red'}`}
                  >
                    {fmtSignedMoney(a.totalPnl, 0)}
                  </span>
                </div>
                <div className="mb-[11px]">
                  <div className="flex justify-between text-[10.5px] font-bold mb-1 text-muted">
                    <span>Winrate</span>
                    <span className={a.winrate >= 50 ? 'text-green' : 'text-red'}>
                      {a.winrate.toFixed(1)}%
                    </span>
                  </div>
                  <span className="block h-[5px] rounded-[3px] bg-surface2 overflow-hidden">
                    <span
                      className={`block h-full rounded-[3px] ${a.winrate >= 50 ? 'bg-green' : 'bg-red'}`}
                      style={{ width: `${a.winrate}%` }}
                    />
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <div className={STAT_CELL}>
                    <span className={STAT_LABEL}>W/L</span>
                    <b className="text-[11.5px] font-extrabold">
                      {a.wins}/{a.losses}
                    </b>
                  </div>
                  <div className={STAT_CELL}>
                    <span className={STAT_LABEL}>Avg</span>
                    <b
                      className={`text-[11.5px] font-extrabold ${a.avgPnl >= 0 ? 'text-green' : 'text-red'}`}
                    >
                      {fmtSignedMoney(a.avgPnl, 0)}
                    </b>
                  </div>
                  <div className={STAT_CELL}>
                    <span className={STAT_LABEL}>PF</span>
                    <b
                      className={`text-[11.5px] font-extrabold ${a.profitFactor === null || a.profitFactor >= 1 ? 'text-green' : 'text-red'}`}
                    >
                      {a.profitFactor === null ? '∞' : a.profitFactor.toFixed(2)}
                    </b>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
