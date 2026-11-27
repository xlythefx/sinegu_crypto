import { describe, expect, it } from 'vitest'
import { computeStrategyStats, type StrategyTrade } from './strategyStats'

function trade(p: Partial<StrategyTrade>): StrategyTrade {
  return { strategy: 'VWMA-Reversion', symbol: 'LTCUSDT', realized_pnl: 1, closed_at: '2026-11-10 12:00:00', ...p }
}

describe('strategy stats: exchanges', () => {
  it('lists the venues of the measured trades (the card no longer says Binance for all)', () => {
    const trades = [
      trade({ exchange: 'mexc', symbol: 'LTC_USDT' }),
      trade({ exchange: 'binance' }),
      trade({}), // an API older than the field: a Binance row
      trade({ exchange: 'bybit', symbol: 'SANTOSUSDT' }),
    ]
    expect(computeStrategyStats('VWMA-Reversion', trades, new Set()).exchanges.sort()).toEqual([
      'binance',
      'bybit',
      'mexc',
    ])
  })

  it('follows the excluded coins, like every other figure on the card', () => {
    const trades = [trade({ exchange: 'binance' }), trade({ exchange: 'bybit', symbol: 'SANTOSUSDT' })]
    const stats = computeStrategyStats('VWMA-Reversion', trades, new Set(['SANTOSUSDT']))
    expect(stats.exchanges).toEqual(['binance'])
    expect(computeStrategyStats('VWMA-Reversion', trades, new Set(['LTCUSDT', 'SANTOSUSDT'])).exchanges).toEqual([])
  })
})
