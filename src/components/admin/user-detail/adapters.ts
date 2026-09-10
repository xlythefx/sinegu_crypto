/** Adapters: admin position/trade rows → the shapes the reusable
 *  `src/components/positions/` tables render. No React here. */

import { displaySymbol } from '../../../lib/chart'
import { fmtDateTime, fmtNum } from '../../../lib/format'
import type { AdminOpenPosition, AdminPastTrade } from '../../../types/admin'
import type { ActivePosition, ClosedTrade, Exchange } from '../../positions/types'

/** Map a broker string ('binance', 'Binance', …) to the display exchange. */
export function brokerToExchange(broker: string): Exchange {
  const b = broker.toLowerCase()
  if (b.includes('bybit')) return 'Bybit'
  if (b.includes('mexc')) return 'MEXC'
  return 'Binance'
}

/** Admin open position → Active Positions table row. */
export function toActiveRow(p: AdminOpenPosition): ActivePosition {
  const notional = Math.abs(p.position_amt * p.price)
  return {
    ticker: displaySymbol(p.symbol),
    avgPrice: fmtNum(p.price),
    exchange: brokerToExchange(p.broker),
    unrealizedPnl: p.unrealized_pnl,
    pnlPct: notional > 0 ? (p.unrealized_pnl / notional) * 100 : 0,
    increments: 1,
  }
}

/** Admin past trade → Closed Positions table row. */
export function toClosedRow(t: AdminPastTrade, pctBase: number): ClosedTrade {
  return {
    ticker: displaySymbol(t.symbol),
    price: fmtNum(t.price),
    strategy: t.strategy ?? 'Manual',
    exchange: brokerToExchange(t.broker),
    pnl: t.realized_pnl,
    pnlPct: pctBase > 0 ? (t.realized_pnl / pctBase) * 100 : 0,
    fee: t.exchange_fee,
    positions: 1,
    closedAt: fmtDateTime(t.closed_at),
  }
}
