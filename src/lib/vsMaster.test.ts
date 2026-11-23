import { describe, expect, it } from 'vitest'
import { fmtGap, showRow, sortRows, summarize } from './vsMaster'
import type { VsMasterRow } from '../types/vsMaster'

function row(p: Partial<VsMasterRow>): VsMasterRow {
  return {
    rank: 1, uni_id: 'x', name: 'Sample', exchanges: ['binance'], connected: true, balance: 1000,
    pnl: 0, pnl_gross: 0, fees: 0, pct: 0, trades: 0, wins: 0, win_rate: null, best_day: null, worst_day: null,
    gap: 0, followed: 0, missed: 0, master_closes: 0, extra: 0, days_ahead: 0, days_behind: 0,
    ...p,
  }
}

const ROWS = [
  row({ rank: 1, uni_id: 'a', name: 'Ann', gap: 1.5, followed: 4, master_closes: 4 }),
  row({ rank: 2, uni_id: 'b', name: 'Ben', gap: -0.5, followed: 3, missed: 1, master_closes: 4 }),
  row({ rank: 3, uni_id: 'c', name: 'Cy', gap: -2.0, followed: 1, missed: 3, master_closes: 4, balance: null }),
  row({ rank: 4, uni_id: 'd', name: 'Dee', gap: null, pct: null }),
]

describe('customers vs master helpers', () => {
  it('summarises ahead / behind, the gaps and the follow rate', () => {
    const s = summarize(ROWS)
    expect([s.compared, s.ahead, s.behind]).toEqual([3, 1, 2])
    expect(s.avgGap).toBeCloseTo(-1 / 3)
    expect(s.medianGap).toBe(-0.5)
    expect(s.followRate).toBeCloseTo(8 / 12 * 100)
    expect(s.missed).toBe(4)
    expect([s.best?.name, s.worst?.name]).toEqual(['Ann', 'Cy'])
  })

  it('filters and sorts, missing values last either way', () => {
    expect(ROWS.filter((r) => showRow(r, 'behind')).map((r) => r.name)).toEqual(['Ben', 'Cy'])
    expect(ROWS.filter((r) => showRow(r, 'missed')).map((r) => r.name)).toEqual(['Ben', 'Cy'])
    expect(sortRows(ROWS, 'gap', 'asc').map((r) => r.name)).toEqual(['Cy', 'Ben', 'Ann', 'Dee'])
    expect(sortRows(ROWS, 'balance', 'desc').map((r) => r.name).at(-1)).toBe('Cy')
  })

  it('prints a gap as percentage points', () => {
    expect(fmtGap(1.234)).toBe('+1.23 pp')
    expect(fmtGap(-0.5)).toBe('−0.50 pp')
  })
})
