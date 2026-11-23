import { describe, expect, it } from 'vitest'
import { duelSeries, fmtGap, leaderboard, mainReason, showRow, sortRows, summarize } from './vsMaster'
import type { VsMasterRow } from '../types/vsMaster'

function row(p: Partial<VsMasterRow>): VsMasterRow {
  return {
    rank: 1, uni_id: 'x', name: 'Sample', exchanges: ['binance'], connected: true, balance: 1000,
    pnl: 0, pnl_gross: 0, fees: 0, pct: 0, trades: 0, wins: 0, win_rate: null, best_day: null, worst_day: null,
    gap: 0, gap_parts: null, followed: 0, missed: 0, master_closes: 0, extra: 0, days_ahead: 0, days_behind: 0,
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

describe('leaderboard, reasons and the head-to-head curve', () => {
  it('pins the master on top, then ranks customers by P&L or by return', () => {
    const master = { pnl: 500, pnl_gross: 520, fees: 20, pct: 2, trades: 9, wins: 6, win_rate: 66.7, best_day: 1, worst_day: -1, balance: 9000 }
    const rows = [row({ uni_id: 'a', name: 'Ann', pnl: 10, pct: 3 }), row({ uni_id: 'b', name: 'Ben', pnl: 90, pct: 1 })]
    const byPnl = leaderboard(rows, master, 'pnl')
    expect(byPnl.map((e) => e.name)).toEqual(['Master', 'Ben', 'Ann'])
    expect(byPnl.map((e) => e.place)).toEqual([null, 1, 2])
    expect(leaderboard(rows, master, 'pct').map((e) => e.name)).toEqual(['Master', 'Ann', 'Ben'])
    expect(leaderboard(rows, null, 'pnl')[0].name).toBe('Ben')
  })

  it('names the part that moved a customer most', () => {
    const behind = row({ gap: -3, gap_parts: { same: -0.5, missed: -2, extra: -0.5, before: 0 } })
    expect(mainReason(behind)).toEqual({ part: 'missed', value: -2 })
    const ahead = row({ gap: 1, gap_parts: { same: 1, missed: 0, extra: 0, before: 0 } })
    expect(mainReason(ahead)).toEqual({ part: 'same', value: 1 })
    expect(mainReason(row({ gap: -1, gap_parts: null }))).toBeNull()
  })

  it('adds the daily % up on every day either side traded', () => {
    const s = duelSeries({
      master: [{ date: '2026-11-03', pct: 2, pnl: 0, trades: 1 }, { date: '2026-11-04', pct: -1, pnl: 0, trades: 1 }],
      customer: [{ date: '2026-11-04', pct: -2, pnl: 0, trades: 1 }, { date: '2026-11-05', pct: 0.5, pnl: 0, trades: 1 }],
    })
    expect(s).toEqual([
      { date: '2026-11-03', master: 2, customer: 0 },
      { date: '2026-11-04', master: 1, customer: -2 },
      { date: '2026-11-05', master: 1, customer: -1.5 },
    ])
  })
})
