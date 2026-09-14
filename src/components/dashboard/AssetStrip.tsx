import { displaySymbol, seriesColor } from '../../lib/chart'
import { fmtSigned } from '../../lib/format'
import type { GroupSeries } from '../../types/dashboard'
import PnlBreakdown from '../ui/PnlBreakdown'

interface AssetStripProps {
  assets: GroupSeries[]
}

/** Bottom strip of compact per-asset cards: dot+symbol, signed total before
 *  fees (hover for after), Win%/PF/trades, and a contribution bar. */
export default function AssetStrip({ assets }: AssetStripProps) {
  if (assets.length === 0) return null
  const maxAbs = Math.max(1, ...assets.map((a) => Math.abs(a.total)))

  return (
    <div className="flex gap-3.5 flex-wrap" data-aos="fade-up" data-aos-delay="400">
      {assets.map((a, i) => {
        const negative = a.total < 0
        return (
          <div
            className="border border-border bg-surface grow basis-[200px] min-w-0 rounded-strip py-3.5 px-[15px]"
            key={a.id}
          >
            <div className="flex items-center justify-between mb-[9px]">
              <div className="flex items-center gap-[7px] text-[13px] font-extrabold min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                <span
                  className="w-[9px] h-[9px] rounded-[3px] flex-none"
                  style={{ background: seriesColor(a.id, i) }}
                />
                {displaySymbol(a.id)}
              </div>
              <PnlBreakdown gross={a.total} net={a.total_net} heading={displaySymbol(a.id)}>
                <span
                  className={`font-mono text-[13px] font-extrabold ${negative ? 'text-red' : 'text-green'}`}
                >
                  {fmtSigned(a.total)}
                </span>
              </PnlBreakdown>
            </div>
            <div className="flex gap-3.5 text-[10.5px] text-muted">
              <span>
                Win{' '}
                <strong className="text-text">
                  {a.win_rate !== null ? `${a.win_rate.toFixed(1)}%` : '—'}
                </strong>
              </span>
              <span>
                PF{' '}
                <strong className="text-text">
                  {a.profit_factor !== null ? a.profit_factor.toFixed(2) : '—'}
                </strong>
              </span>
              <span>
                {a.trades} trade{a.trades === 1 ? '' : 's'}
              </span>
            </div>
            <div className="mt-[9px] h-[5px] bg-surface2 rounded-[3px] overflow-hidden">
              <div
                className={`h-full rounded-[3px] ${negative ? 'bg-red' : 'bg-green'}`}
                style={{ width: `${Math.round((Math.abs(a.total) / maxAbs) * 100)}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
