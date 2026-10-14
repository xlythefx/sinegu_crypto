import { fmtQty } from '../../lib/format'
import type { TradeSide } from '../../lib/tradeSide'

/** The line under a ticker: LONG (green) / SHORT (red) and the size. Shared by
 *  the trader's Positions page and the admin tables, so a trade reads the same
 *  everywhere. Renders nothing when the direction is unknown. */
export default function SideTag({
  side,
  qty,
}: {
  side: TradeSide | null
  qty?: number | null
}) {
  if (!side) return null
  return (
    <span className="flex items-center gap-1.5 text-[10.5px] font-mono font-semibold">
      <span className={side === 'LONG' ? 'text-green' : 'text-red'}>{side}</span>
      {qty != null && qty !== 0 && (
        <span className="text-faint font-normal">{fmtQty(Math.abs(qty))}</span>
      )}
    </span>
  )
}
