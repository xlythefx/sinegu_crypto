import { describe, expect, it } from 'vitest'
import { captionBaseSize, captionLayout, fitText, unitOf, usesPixelFont, wrapText, type Measure } from './templates'

/** Every character is 0.6 em wide. */
const mono: Measure = (text, size) => text.length * size * 0.6

describe('wrapText', () => {
  it('wraps greedily on words', () => {
    // 100 px at size 10 = 16 characters a line.
    expect(wrapText('one two three four five six', 100, 10, mono)).toEqual(['one two three', 'four five six'])
  })

  it('keeps an over-long word on its own line, and honours line breaks', () => {
    expect(wrapText('a supercalifragilistic b', 60, 10, mono)).toEqual(['a', 'supercalifragilistic', 'b'])
    expect(wrapText('first\nsecond', 1000, 10, mono)).toEqual(['first', 'second'])
  })
})

describe('fitText', () => {
  it('uses the largest size at which the text fits', () => {
    const r = fitText('HIGH SCORE', 300, 1, 100, 10, mono)
    expect(r.lines).toEqual(['HIGH SCORE'])
    expect(mono('HIGH SCORE', r.size)).toBeLessThanOrEqual(300)
    expect(mono('HIGH SCORE', r.size + 3)).toBeGreaterThan(300)
  })

  it('wraps onto more lines rather than going below the minimum', () => {
    const r = fitText('This week with Pixel Alpha', 300, 3, 60, 20, mono)
    expect(r.lines.length).toBeGreaterThan(1)
    expect(r.lines.length).toBeLessThanOrEqual(3)
    expect(r.size).toBeGreaterThanOrEqual(20)
  })
})

describe('caption layout', () => {
  it('scales from the short side of the frame', () => {
    expect(unitOf(1080, 1920)).toBe(1)
    expect(unitOf(1920, 1080)).toBe(1)
    expect(captionBaseSize('hook', 'bold', 1080, 1920)).toBeGreaterThan(captionBaseSize('body', 'bold', 1080, 1920))
    expect(captionBaseSize('disclaimer', 'bold', 1080, 1920)).toBeLessThan(captionBaseSize('body', 'bold', 1080, 1920))
  })

  it('places top and bottom captions and keeps them within 86% of the width', () => {
    const boxes = captionLayout(
      [
        { id: 'a', text: 'Up 3.1% this week', style: 'hook', position: 'top' },
        { id: 'b', text: 'Twelve trades, LTC the best coin of the whole week by far', style: 'body', position: 'bottom' },
      ],
      'bold',
      1080,
      1920,
      mono,
    )
    expect(boxes).toHaveLength(2)
    expect(boxes[0].y).toBeLessThan(1920 / 2)
    expect(boxes[1].y).toBeGreaterThan(1920 / 2)
    for (const b of boxes) expect(b.width).toBeLessThanOrEqual(1080 * 0.86 + 1e-9)
  })

  it('stacks two captions that share a position without overlapping', () => {
    const [a, b] = captionLayout(
      [
        { id: 'a', text: 'First line', style: 'body', position: 'middle' },
        { id: 'b', text: 'Second line', style: 'body', position: 'middle' },
      ],
      'clean',
      1080,
      1920,
      mono,
    )
    expect(a.y + a.height / 2).toBeLessThanOrEqual(b.y - b.height / 2)
  })

  it('skips empty captions', () => {
    expect(captionLayout([{ id: 'a', text: '  ', style: 'body', position: 'top' }], 'clean', 1080, 1920, mono)).toEqual([])
  })
})

describe('usesPixelFont', () => {
  it('is needed for pixel cards or pixel captions only', () => {
    expect(usesPixelFont(['clean-title', 'disclaimer'], 'bold')).toBe(false)
    expect(usesPixelFont(['pixel-scoreboard'], 'bold')).toBe(true)
    expect(usesPixelFont([], 'pixel')).toBe(true)
  })
})
