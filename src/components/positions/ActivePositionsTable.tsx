import type { ActivePosition } from './types'

const TH = 'text-left text-[11px] font-bold tracking-[0.04em] uppercase text-faint py-2.5 px-3 border-b border-hair whitespace-nowrap'
const TD = 'py-3 px-3 border-b border-hair align-middle'

function tickerInitials(ticker: string) {
  return ticker.split('/')[0].slice(0, 3)
}

/** Active positions table: Ticker · Price · Exchange · Unrealized P&L · Increments. */
export default function ActivePositionsTable({ rows }: { rows: ActivePosition[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className={TH}>Ticker</th>
            <th className={TH}>Price</th>
            <th className={TH}>Exchange</th>
            <th className={TH}>Unrealized P&L</th>
            <th className={TH}>Increments</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-muted text-[13px] py-7 px-3">
                No positions found matching the selected filters.
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const positive = row.unrealizedPnl >= 0
            const tone = positive ? 'text-green' : 'text-red'
            return (
              <tr
                key={`${row.ticker}-${row.exchange}`}
                className="transition-colors hover:bg-surface2"
              >
                <td className={TD}>
                  <div className="flex items-center gap-[9px] font-bold whitespace-nowrap">
                    <span className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-[9px] bg-accent-soft border border-accent-line text-accent text-[9.5px] font-semibold flex-none font-mono">
                      {tickerInitials(row.ticker)}
                    </span>
                    {row.ticker}
                  </div>
                </td>
                <td className={`${TD} font-mono`}>${row.avgPrice}</td>
                <td className={TD}>
                  <span className="inline-flex items-center py-[3px] px-[9px] rounded-pill border border-border text-[11.5px] font-semibold text-muted whitespace-nowrap">
                    {row.exchange}
                  </span>
                </td>
                <td className={TD}>
                  <div className="flex flex-col gap-0.5">
                    <span className={`text-[13px] font-bold font-mono ${tone}`}>
                      {positive ? '+' : '−'}${Math.abs(row.unrealizedPnl).toFixed(2)}
                    </span>
                    <span className={`text-[11px] font-semibold font-mono ${tone}`}>
                      {positive ? '+' : '−'}
                      {Math.abs(row.pnlPct).toFixed(2)}%
                    </span>
                  </div>
                </td>
                <td className={`${TD} font-mono`}>{row.increments}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
