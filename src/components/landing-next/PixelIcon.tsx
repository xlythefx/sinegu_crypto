import { litCells, PIXEL_GRID, type PixelGlyph } from './pixelGlyphs'

interface PixelIconProps {
  glyph: PixelGlyph
  /** Edge length in px. A multiple of 12 keeps every pixel on whole device pixels. */
  size?: number
  className?: string
}

/**
 * One hand-drawn pixel glyph (`pixelGlyphs.ts`) as an SVG of squares in
 * `currentColor`. `crispEdges` stops the browser antialiasing the seams
 * between neighbouring squares into faint grid lines. Decorative: the text
 * beside it says what it means.
 */
export default function PixelIcon({ glyph, size = 24, className = '' }: PixelIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${PIXEL_GRID} ${PIXEL_GRID}`}
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={className}
    >
      {litCells(glyph).map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />
      ))}
    </svg>
  )
}
