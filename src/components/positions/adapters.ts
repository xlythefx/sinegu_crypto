import { displaySymbol } from '../../lib/chart'
import { fmtDateTime, fmtNum } from '../../lib/format'
import type { OpenPosition, PastPosition } from '../../types/dashboard'
import type { ActivePosition, ClosedTrade } from './types'

const num = (v: string | null): number => (v === null ? 0 : Number(v))

/** API open position → the Active Positions table row shape. */
export function toActivePosition(p: OpenPosition): ActivePosition {
  const upnl = num(p.unrealized_profit)
  const notional = Math.abs(num(p.notional))
  return {
    ticker: displaySymbol(p.symbol),
    avgPrice: fmtNum(num(p.entry_price)),
    exchange: 'Binance', // all connected accounts are Binance for now
    unrealizedPnl: upnl,
    pnlPct: notional > 0 ? (upnl / notional) * 100 : 0,
    increments: 1,
  }
}

/** API closed position → the Closed Positions table row shape. */
export function toClosedTrade(p: PastPosition, pctBase: number): ClosedTrade {
  const pnl = num(p.realized_pnl)
  return {
    ticker: displaySymbol(p.symbol),
    price: fmtNum(num(p.exit_price)),
    strategy: p.strategy ?? 'Manual',
    exchange: 'Binance',
    pnl,
    pnlPct: pctBase > 0 ? (pnl / pctBase) * 100 : 0,
    positions: 1,
    closedAt: fmtDateTime(p.closed_at),
  }
}
