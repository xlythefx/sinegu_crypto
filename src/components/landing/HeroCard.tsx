import { useState } from 'react'
import { usePoll } from '../../hooks/usePoll'
import OrderBook from './OrderBook'
import PerformancePanel from './PerformancePanel'
import type { TrackRecordPoint, TrackRecordStats } from '../../types/publicStats'

/** How long each face holds before the card turns over. */
const FACE_MS = 5_000

const FACE_BASE =
  'col-start-1 row-start-1 transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.2,0.7,0.2,1)]'
const FACE_ON = 'opacity-100 translate-y-0'
const FACE_OFF = 'opacity-0 translate-y-2 pointer-events-none'

const DOT_BASE = 'h-1.5 rounded-pill transition-all duration-500'

interface HeroCardProps {
  stats: TrackRecordStats | null
  series: TrackRecordPoint[]
}

/**
 * The hero's card, which alternates between the live order book and the
 * verified track record.
 *
 * Both faces are always mounted, stacked in ONE grid cell: the card is then as
 * tall as the taller of the two and never resizes mid-turn, which is what
 * would otherwise shove the whole hero up and down every five seconds. It also
 * means the book keeps polling while the record is showing, so turning back to
 * it shows a current book rather than one frozen at the moment it faded out.
 *
 * Rotation pauses while the pointer is over the card — someone reading a price
 * ladder should not have it taken away — and, through `usePoll`, while the tab
 * is hidden.
 */
export default function HeroCard({ stats, series }: HeroCardProps) {
  const [face, setFace] = useState(0)
  const [held, setHeld] = useState(false)

  usePoll(() => setFace((current) => (current === 0 ? 1 : 0)), FACE_MS, {
    // A rotation is a display, not data: flipping the instant someone returns
    // to the tab reads as a glitch rather than a refresh.
    immediateOnResume: false,
    paused: held,
  })

  const faces = [
    <OrderBook key="book" />,
    <PerformancePanel key="record" stats={stats} series={series} />,
  ]

  return (
    <div
      className="relative animate-[fadeup_0.8s_cubic-bezier(0.2,0.7,0.2,1)_0.15s_both]"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
    >
      <div className="grid">
        {faces.map((node, i) => (
          <div
            key={i}
            className={`${FACE_BASE} ${face === i ? FACE_ON : FACE_OFF}`}
            aria-hidden={face !== i}
          >
            {node}
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-1.5 mt-3.5">
        {faces.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setFace(i)}
            aria-label={i === 0 ? 'Show the live order book' : 'Show the track record'}
            aria-pressed={face === i}
            className={`${DOT_BASE} cursor-pointer border-none ${
              face === i ? 'w-6 bg-accent' : 'w-1.5 bg-border hover:bg-muted'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
