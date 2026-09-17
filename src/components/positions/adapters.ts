import { displaySymbol } from '../../lib/chart'
import { fmtDateTime, fmtNum } from '../../lib/format'
import type { OpenPosition, PastPosition } from '../../types/dashboard'
import type { ExchangeKind } from '../../types/exchanges'
import { EXCHANGE_META } from '../exchanges/meta'
import type { ActivePosition, ClosedTrade, Exchange } from './types'

const num = (v: string | null): number => (v === null ? 0 : Number(v))

/** The venue label for a row; rows from an API that predates the `exchange`
 *  column are Binance rows. */
function exchangeLabel(exchange: ExchangeKind | undefined): Exchange {
  return EXCHANGE_META[exchange ?? 'binance'].label as Exchange
}

/** API open position → the Active Positions table row shape. */
export function toActivePosition(p: OpenPosition): ActivePosition {
  const upnl = num(p.unrealized_profit)
  const notional = Math.abs(num(p.notional))
  return {
    ticker: displaySymbol(p.symbol),
    avgPrice: fmtNum(num(p.entry_price)),
    exchange: exchangeLabel(p.exchange),
    unrealizedPnl: upnl,
    pnlPct: notional > 0 ? (upnl / notional) * 100 : 0,
    increments: 1,
  }
}

/** API closed position → the Closed Positions table row shape.
 *
 *  `realized_pnl` already arrives net of the exchange's commission, so the row
 *  reads the same as the trade does in the customer's Binance app. `fee` is
 *  carried alongside only to show what came out — never to subtract again. */
export function toClosedTrade(p: PastPosition, pctBase: number): ClosedTrade {
  const pnl = num(p.realized_pnl)
  return {
    ticker: displaySymbol(p.symbol),
    price: fmtNum(num(p.exit_price)),
    strategy: p.strategy ?? 'Manual',
    exchange: exchangeLabel(p.exchange),
    pnl,
    pnlPct: pctBase > 0 ? (pnl / pctBase) * 100 : 0,
    fee: p.exchange_fee === null ? null : num(p.exchange_fee),
    feeSource: p.fee_source,
    positions: 1,
    closedAt: fmtDateTime(p.closed_at),
  }
}
