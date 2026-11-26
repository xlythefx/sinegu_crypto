import { describe, expect, it } from 'vitest'
import { litCells } from './orderBook'

describe('litCells — blocks lit on the pixel card meters', () => {
  it('lights none for an empty slice', () => {
    expect(litCells(0, 8)).toBe(0)
    expect(litCells(-5, 8)).toBe(0)
    expect(litCells(Number.NaN, 8)).toBe(0)
  })

  it('lights at least one block for anything that is there', () => {
    expect(litCells(0.1, 8)).toBe(1)
  })

  it('rounds to the nearest block and never passes the meter', () => {
    // 8 blocks: 50% = 4, 56% = 4.48 -> 4, 57% = 4.56 -> 5, 100% = 8.
    expect(litCells(50, 8)).toBe(4)
    expect(litCells(56, 8)).toBe(4)
    expect(litCells(57, 8)).toBe(5)
    expect(litCells(100, 8)).toBe(8)
    expect(litCells(140, 8)).toBe(8)
  })
})
