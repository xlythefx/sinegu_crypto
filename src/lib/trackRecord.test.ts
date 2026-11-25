import { describe, expect, it } from 'vitest'
import { recordCoins, recordScopeNote } from './trackRecord'
import type { TrackRecordPoint } from '../types/publicStats'

const point = (date: string, symbols: string[]): TrackRecordPoint => ({
  date,
  pct: 0,
  cumulative: 0,
  trades: symbols.length,
  assets: symbols.map((symbol) => ({ symbol, pct: 0, trades: 1 })),
})

describe('recordCoins', () => {
  it('names each coin once, whatever the venue spelling, A to Z', () => {
    const series = [point('2026-11-01', ['SANTOSUSDT', 'LTCUSDT']), point('2026-11-02', ['LTC_USDT', 'RENDERUSDT'])]
    expect(recordCoins(series)).toEqual(['LTC', 'RENDER', 'SANTOS'])
  })
})

describe('recordScopeNote', () => {
  const series = [point('2026-11-01', ['LTCUSDT', 'RENDERUSDT', 'SANTOSUSDT'])]

  // The page publishes a higher figure when retired coins are excluded, so
  // it must say they are left out whenever any are.
  it('says retired coins are left out whenever any are excluded', () => {
    expect(recordScopeNote(series, ['BTCUSDT', 'ALGOUSDT'])).toBe(
      'Covers LTC, RENDER and SANTOS. Coins we no longer trade are left out.',
    )
  })

  it('only names the coins when nothing is excluded', () => {
    expect(recordScopeNote(series, [])).toBe('Covers LTC, RENDER and SANTOS.')
  })

  it('says nothing when there are no trades to describe', () => {
    expect(recordScopeNote([], ['BTCUSDT'])).toBeNull()
  })
})
