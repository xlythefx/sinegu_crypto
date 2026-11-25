import { describe, expect, it } from 'vitest'
import { billMonth, FEE_EXAMPLE } from './pricing'

// Expected figures derived by hand from the rule (bill only when the month
// ends above the mark; then 20% of the month's closed profit), never copied
// from the code under test.
describe('the home page fee example', () => {
  it('bills the profitable month, then nothing while the account is under its high', () => {
    expect(FEE_EXAMPLE.map((m) => m.endEquity)).toEqual([2300, 2100, 2250])
    expect(FEE_EXAMPLE.map((m) => m.markBefore)).toEqual([2000, 2300, 2300])
    expect(FEE_EXAMPLE.map((m) => m.bill)).toEqual([60, 0, 0])
  })
})

describe('billMonth', () => {
  it('owes nothing on a month that ends exactly at the mark', () => {
    expect(billMonth('x', 2300, 2200, 100).bill).toBe(0)
  })

  it('never bills a loss, and keeps the mark where it was', () => {
    const month = billMonth('x', 2000, 2000, -50)
    expect(month.bill).toBe(0)
    expect(month.markAfter).toBe(2000)
  })

  it('bills the whole month of closed profit once the account is above its mark', () => {
    // 2,250 → 2,500 against a 2,300 mark: 20% of the month's 250.
    const month = billMonth('x', 2300, 2250, 250)
    expect(month.bill).toBe(50)
    expect(month.markAfter).toBe(2500)
  })
})
