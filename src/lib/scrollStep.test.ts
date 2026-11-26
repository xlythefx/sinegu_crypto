import { describe, expect, it } from 'vitest'
import { stepAtLine, stepByTravel } from './scrollStep'

describe('stepAtLine', () => {
  const tops = [100, 300, 500, 700, 900]

  it('reads the first step before any has reached the line', () => {
    expect(stepAtLine(tops, 50)).toBe(0)
  })

  it('moves to each step as its top passes the line', () => {
    expect(stepAtLine(tops, 300)).toBe(1)
    expect(stepAtLine(tops, 650)).toBe(2)
  })

  it('stays on the last step once every step has passed', () => {
    expect(stepAtLine(tops, 2000)).toBe(4)
  })

  it('handles an empty list', () => {
    expect(stepAtLine([], 500)).toBe(0)
  })
})

describe('stepByTravel', () => {
  // The list's top travels from 800px down the screen to 300px: 100px a step.
  const at = (top: number) => stepByTravel(top, 800, 300, 5)

  it('starts on the first step', () => {
    expect(at(900)).toBe(0)
    expect(at(800)).toBe(0)
    expect(at(701)).toBe(0)
  })

  it('moves one step per fifth of the travel', () => {
    expect(at(700)).toBe(1)
    expect(at(550)).toBe(2)
    expect(at(400)).toBe(4)
  })

  it('stays on the last step past the end of the travel', () => {
    expect(at(300)).toBe(4)
    expect(at(-200)).toBe(4)
  })

  it('never divides by a zero or backwards travel', () => {
    expect(stepByTravel(500, 300, 300, 5)).toBe(0)
    expect(stepByTravel(500, 200, 300, 5)).toBe(0)
    expect(stepByTravel(500, 800, 300, 1)).toBe(0)
  })
})
