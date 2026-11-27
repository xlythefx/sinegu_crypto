import { describe, expect, it } from 'vitest'
import {
  coinKey,
  coinOptions,
  exchangeCounts,
  filterStrategyTrades,
  ownerCounts,
  type StrategyFilters,
} from './strategyFilters'
import { rangeFor } from './dateRange'
import type { StrategyTrade } from './strategyStats'

const NONE: StrategyFilters = { coins: [], exchange: 'all', side: 'all', owner: 'all', date: 'all', from: '', to: '' }

function trade(p: Partial<StrategyTrade>): StrategyTrade {
  return {
    strategy: 'VWMA-Reversion',
    symbol: 'LTCUSDT',
    realized_pnl: 1,
    closed_at: '2026-11-10 12:00:00',
    exchange: 'binance',
    uni_id: 'm1',
    owner_name: 'Master',
    owner_role: 'master',
    ...p,
  }
}

const TRADES: StrategyTrade[] = [
  trade({}),
  trade({ symbol: 'LTC_USDT', exchange: 'mexc' }),
  trade({ symbol: 'SANTOSUSDT', uni_id: 'c1', owner_name: 'Cust A', owner_role: 'user' }),
  trade({ symbol: 'SANTOSUSDT', uni_id: 't1', owner_name: 'Tester', owner_role: 'tester', closed_at: '2026-10-05 12:00:00' }),
]

describe('strategy filters', () => {
  it('treats LTCUSDT and LTC_USDT as one coin', () => {
    expect(coinKey('LTC_USDT')).toBe('LTCUSDT')
    expect(filterStrategyTrades(TRADES, { ...NONE, coins: ['LTCUSDT'] })).toHaveLength(2)
  })

  it('combines coins, exchange and owner', () => {
    expect(filterStrategyTrades(TRADES, { ...NONE, coins: ['LTCUSDT', 'SANTOSUSDT'] })).toHaveLength(4)
    expect(filterStrategyTrades(TRADES, { ...NONE, coins: ['LTCUSDT'], exchange: 'mexc' })).toHaveLength(1)
    expect(filterStrategyTrades(TRADES, { ...NONE, owner: 'customers' })).toHaveLength(1)
    expect(filterStrategyTrades(TRADES, { ...NONE, owner: 'testers' })).toHaveLength(1)
    expect(filterStrategyTrades(TRADES, { ...NONE, owner: 'u:c1' })).toHaveLength(1)
  })

  it('filters by custom dates and by month presets, both ends inclusive', () => {
    const nov = { ...NONE, date: 'custom' as const, from: '2026-11-01', to: '2026-11-10' }
    expect(filterStrategyTrades(TRADES, nov)).toHaveLength(3)
    const now = new Date(2026, 10, 23)
    expect(rangeFor('last_month', { from: '', to: '' }, now)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(rangeFor('month', { from: '', to: '' }, now)).toEqual({ from: '2026-11-01', to: '2026-11-23' })
    expect(filterStrategyTrades(TRADES, { ...NONE, date: 'last_month' }, undefined, now)).toHaveLength(1)
  })

  it('counts each facet under the OTHER filters', () => {
    const f = { ...NONE, exchange: 'binance', coins: ['SANTOSUSDT'] }
    const coins = coinOptions(TRADES, f)
    expect(coins.find((c) => c.key === 'LTCUSDT')?.count).toBe(1) // binance LTC only
    expect(coins.find((c) => c.key === 'SANTOSUSDT')?.count).toBe(2)
    expect(exchangeCounts(TRADES, f).get('mexc')).toBe(0) // no SANTOS on MEXC, still listed
    const owners = ownerCounts(TRADES, f)
    expect(owners.all).toBe(2)
    expect(owners.people[0].role).toBe('master')
  })

  it("narrows to the sub-master's trades (QuantLab's feed)", () => {
    const withSub = [
      ...TRADES,
      trade({ strategy: 'VWMA-Reversion - QuantLab', uni_id: 's1', owner_name: 'Dima', owner_role: 'submaster' }),
    ]
    const only = filterStrategyTrades(withSub, { ...NONE, owner: 'submaster' })
    expect(only.map((t) => t.uni_id)).toEqual(['s1'])
    expect(ownerCounts(withSub, NONE).submaster).toBe(1)
    expect(filterStrategyTrades(withSub, { ...NONE, owner: 'master' })).toHaveLength(2)
  })
})
