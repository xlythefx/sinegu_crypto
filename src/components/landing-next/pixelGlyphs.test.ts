import { describe, expect, it } from 'vitest'
import { litCells, PIXEL_GLYPHS, PIXEL_GRID, type PixelGlyph } from './pixelGlyphs'

describe('pixel glyphs', () => {
  for (const name of Object.keys(PIXEL_GLYPHS) as PixelGlyph[]) {
    it(`${name} is a full ${PIXEL_GRID} × ${PIXEL_GRID} grid`, () => {
      const rows = PIXEL_GLYPHS[name]
      expect(rows).toHaveLength(PIXEL_GRID)
      for (const row of rows) expect(row).toHaveLength(PIXEL_GRID)
      expect(litCells(name).length).toBeGreaterThan(0)
    })
  }
})
