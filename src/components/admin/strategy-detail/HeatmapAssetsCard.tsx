import { useMemo, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Trophy, TrendingDown, TrendingUp } from 'lucide-react'
import SignedBars from './SignedBars'
import { fmtMoney, fmtSignedMoney } from '../../../lib/format'
import type { StrategyDetailStats } from '../../../lib/strategyStats'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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
    <section className="dcard" data-aos="fade-up">
      <div className="asd-section-head">
        <div className="dcard__title-row">
          <span className="dchip">
            <Calendar size={16} />
          </span>
          <div>
            <div className="dcard__title">Heatmaps &amp; Asset Performance</div>
            <div className="dcard__sub">
              Daily P&L calendar · winners &amp; losers by instrument
            </div>
          </div>
        </div>
        <div className="asd-cal__nav">
          <button
            type="button"
            className="asd-icon-btn"
            aria-label="Previous month"
            onClick={() => setMonth((mo) => new Date(mo.getFullYear(), mo.getMonth() - 1, 1))}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="asd-cal__month">{monthLabel}</span>
          <button
            type="button"
            className="asd-icon-btn"
            aria-label="Next month"
            disabled={atCurrentMonth}
            onClick={() => setMonth((mo) => new Date(mo.getFullYear(), mo.getMonth() + 1, 1))}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="asd-heatgrid">
        {/* LEFT: calendar */}
        <div>
          <p className="asd-panel-label">
            <Calendar size={13} /> Daily P&L Heatmap
          </p>
          <div className="asd-cal">
            {WEEKDAYS.map((wd) => (
              <div className="asd-cal__wd" key={wd}>
                {wd}
              </div>
            ))}
            {cells.map((cell, i) =>
              cell === null ? (
                <div key={i} className="asd-cal__blank" />
              ) : (
                <div
                  key={i}
                  className={`asd-cal__cell asd-heat--${heatLevel(cell.pnl, calMaxAbs)}`}
                  title={
                    cell.pnl !== 0
                      ? `${cell.iso}: ${fmtSignedMoney(cell.pnl)}`
                      : cell.iso
                  }
                >
                  <span className="asd-cal__day">{cell.day}</span>
                  {cell.pnl !== 0 && (
                    <span className="asd-cal__pnl">
                      {cell.pnl >= 0 ? '+' : '−'}
                      {compact(Math.abs(cell.pnl))}
                    </span>
                  )}
                </div>
              ),
            )}
          </div>
          <div className="asd-cal__legend">
            <span className="asd-heat--n4" />
            <span className="asd-heat--n2" />
            <span className="asd-heat--z" />
            <span className="asd-heat--p2" />
            <span className="asd-heat--p4" />
            Loss → Neutral → Profit
          </div>

          {/* Day-of-week strip */}
          <p className="asd-panel-label asd-panel-label--mt">Best / worst days</p>
          <div className="asd-dow">
            {stats.dayOfWeek.map((d) => (
              <div className="asd-dow__col" key={d.label}>
                <div
                  className={`asd-dow__tile asd-heat--${d.trades > 0 ? heatLevel(d.pnl, dowMaxAbs) : 'z'}`}
                  title={`${d.label}: ${fmtSignedMoney(d.pnl)} · ${d.trades} trades`}
                >
                  <span className="asd-dow__day">{d.label}</span>
                  {d.trades > 0 && (
                    <span className="asd-dow__pnl">
                      {d.pnl >= 0 ? '+' : '−'}
                      {compact(Math.abs(d.pnl))}
                    </span>
                  )}
                </div>
                {d.trades > 0 && (
                  <span className="asd-dow__wl mono">
                    {d.wins}W/{d.losses}L
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: asset performance */}
        <div className="asd-assets">
          <p className="asd-panel-label">
            <Trophy size={13} /> Asset Performance
          </p>
          {stats.byAsset.length === 0 ? (
            <div className="asd-empty">No asset data available.</div>
          ) : (
            <>
              {stats.byAsset.length > 1 && <SignedBars data={assetBars} barMax={44} />}

              <div className="asd-wl">
                {winners.length > 0 && (
                  <div className="asd-wl__col">
                    <p className="asd-wl__label is-pos">
                      <TrendingUp size={12} /> Winners ({winners.length})
                    </p>
                    <div className="asd-wl__table">
                      {winners.map((a) => (
                        <button
                          type="button"
                          key={a.ticker}
                          className="asd-wl__row"
                          onClick={() => onOpenAsset(a.ticker)}
                        >
                          <span className="asd-wl__name">
                            <span className="asd-swatch" style={{ background: a.color }} />
                            {a.display}
                          </span>
                          <span className="mono is-pos">+{fmtMoney(a.totalPnl).slice(1)}</span>
                          <span className="asd-wl__wr mono">{a.winrate.toFixed(0)}%</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {losers.length > 0 && (
                  <div className="asd-wl__col">
                    <p className="asd-wl__label is-neg">
                      <TrendingDown size={12} /> Losers ({losers.length})
                    </p>
                    <div className="asd-wl__table">
                      {losers.map((a) => (
                        <button
                          type="button"
                          key={a.ticker}
                          className="asd-wl__row"
                          onClick={() => onOpenAsset(a.ticker)}
                        >
                          <span className="asd-wl__name">
                            <span className="asd-swatch" style={{ background: a.color }} />
                            {a.display}
                          </span>
                          <span className="mono is-neg">{fmtSignedMoney(a.totalPnl)}</span>
                          <span className="asd-wl__wr mono">{a.winrate.toFixed(0)}%</span>
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
        <div className="asd-assetcards-wrap">
          <p className="asd-panel-label">Asset Details</p>
          <div className="asd-assetcards">
            {stats.byAsset.map((a) => (
              <button
                type="button"
                key={a.ticker}
                className="asd-assetcard"
                onClick={() => onOpenAsset(a.ticker)}
              >
                <div className="asd-assetcard__head">
                  <span className="asd-swatch" style={{ background: a.color }} />
                  <div className="asd-assetcard__name">
                    <b>{a.display}</b>
                    <span>{a.trades} trades</span>
                  </div>
                  <span
                    className={`asd-assetcard__badge mono ${a.totalPnl >= 0 ? 'is-badge-pos' : 'is-badge-neg'}`}
                  >
                    {fmtSignedMoney(a.totalPnl, 0)}
                  </span>
                </div>
                <div className="asd-assetcard__wr">
                  <div className="asd-assetcard__wr-head">
                    <span>Winrate</span>
                    <span className={a.winrate >= 50 ? 'is-pos' : 'is-neg'}>
                      {a.winrate.toFixed(1)}%
                    </span>
                  </div>
                  <span className="asd-assetcard__track">
                    <span
                      className={`asd-assetcard__fill ${a.winrate >= 50 ? 'is-bg-pos' : 'is-bg-neg'}`}
                      style={{ width: `${a.winrate}%` }}
                    />
                  </span>
                </div>
                <div className="asd-assetcard__stats">
                  <div>
                    <span>W/L</span>
                    <b>
                      {a.wins}/{a.losses}
                    </b>
                  </div>
                  <div>
                    <span>Avg</span>
                    <b className={a.avgPnl >= 0 ? 'is-pos' : 'is-neg'}>
                      {fmtSignedMoney(a.avgPnl, 0)}
                    </b>
                  </div>
                  <div>
                    <span>PF</span>
                    <b className={a.profitFactor === null || a.profitFactor >= 1 ? 'is-pos' : 'is-neg'}>
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
