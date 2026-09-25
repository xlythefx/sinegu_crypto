import type { ReactNode } from 'react'

interface DimmableProps {
  /** True when the card has nothing to measure in the current view. */
  dim: boolean
  children: ReactNode
  className?: string
}

/**
 * Tints a card down when its figures are all empty — no trades in the
 * current exchange / date / ticker selection — so a wall of dashes and $0.00
 * reads as "nothing here" at a glance instead of as data. The card still
 * renders (its layout is the explanation of what WOULD be there); it is just
 * pushed back, and not interactive, since there is nothing to hover or switch.
 *
 * The wrapper is the grid item, so it passes the stretch on to the card: a
 * dimmed card must stay the same height as its undimmed neighbour.
 */
export default function Dimmable({ dim, children, className = '' }: DimmableProps) {
  return (
    <div
      className={`flex flex-col [&>*]:flex-1 transition-[opacity,filter] duration-300 ${
        dim ? 'opacity-45 saturate-[0.35] brightness-[0.85] pointer-events-none select-none' : ''
      } ${className}`}
      aria-disabled={dim || undefined}
    >
      {children}
    </div>
  )
}
