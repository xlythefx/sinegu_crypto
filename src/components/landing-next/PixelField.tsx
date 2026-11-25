import { useId } from 'react'

/** A few cells lit in the accent, fixed so the field never reshuffles. */
const LIT: [number, number][] = [
  [3, 2], [4, 2], [9, 5], [15, 1], [21, 4], [22, 4], [27, 2], [33, 6], [38, 3], [44, 1], [45, 1],
  [6, 9], [12, 11], [19, 8], [30, 10], [41, 9], [48, 7], [52, 3],
]

const CELL = 18

/**
 * The hero's backdrop: a faint grid of square dots, fading out from the top
 * left, with a scatter of lit pixels — the brand's pixel motif instead of the
 * old floating bubbles and glow blob. Pure SVG, no animation, no image.
 */
export default function PixelField() {
  const id = useId().replace(/:/g, '')
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none [mask-image:radial-gradient(120%_90%_at_0%_0%,black,transparent_75%)]"
    >
      <defs>
        <pattern id={`dots-${id}`} width={CELL} height={CELL} patternUnits="userSpaceOnUse">
          <rect x={0} y={0} width={2} height={2} fill="var(--border)" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#dots-${id})`} />
      <g fill="var(--accent)" opacity={0.35} shapeRendering="crispEdges">
        {LIT.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x * CELL} y={y * CELL} width={6} height={6} />
        ))}
      </g>
    </svg>
  )
}
