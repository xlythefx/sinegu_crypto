import { MIN_DEPOSIT_USDT } from '../../lib/pricing'
import { STEP_SCROLL_PX, useScrollStep } from '../../hooks/useScrollStep'
import PixelIcon from './PixelIcon'
import type { PixelGlyph } from './pixelGlyphs'
import { CONTAINER, H2, LEAD } from './layout'

interface Step {
  glyph: PixelGlyph
  title: string
  body: string
  /** The step where the customer's money is: labelled as the boundary. */
  yours?: boolean
}

const STEPS: Step[] = [
  {
    glyph: 'signal',
    title: 'The strategy sends a signal',
    body: 'An alert from our strategy on TradingView: buy, sell or exit one coin.',
  },
  {
    glyph: 'engine',
    title: 'Our engine checks your account',
    body: `Has it been funded with at least ${MIN_DEPOSIT_USDT.toLocaleString('en-US')} USDT? Is there room left in the position? Then it sizes the order to your balance.`,
  },
  {
    glyph: 'vault',
    title: 'The order lands on your exchange',
    body: 'Placed with the trade-only key you gave us. The position is yours, and you can watch it in your exchange’s own app.',
    yours: true,
  },
  {
    glyph: 'flag',
    title: 'An exit signal closes it',
    body: 'The profit or loss goes straight into your own futures wallet.',
  },
  {
    glyph: 'receipt',
    title: 'One invoice on the 1st',
    body: 'For last month, and only if your account ended it at a new high. Otherwise there is nothing to pay.',
  },
]

const GAPS = STEPS.length - 1

/**
 * "Your money stays here" as a gold badge (owner, 2026-11-27: the 11px gold
 * text was there on a phone but nobody saw it). Same badge on both layouts;
 * where it sits differs (above the tile wide, above the title on a phone).
 */
// No `display` here: each copy sets its own (inline-flex vs hidden), or the
// two classes fight and the phone copy shows on a computer too.
const YOURS_BADGE =
  'items-center gap-1.5 whitespace-nowrap rounded-pill border border-accent-line bg-accent-soft px-2.5 py-1 font-mono text-[12px] font-bold text-accent'

/** A wide screen only: step 3's tile is the strip's one gold tile. */
const YOURS_TILE_WIDE =
  'min-[961px]:border-2 min-[961px]:border-accent min-[961px]:shadow-[0_0_0_4px_var(--accentLine),0_0_22px_-6px_var(--accent)]'

/** A phone only: the step the reader has scrolled to. */
const ACTIVE_TILE_PHONE =
  'max-[960px]:border-2 max-[960px]:border-accent max-[960px]:bg-accent-soft max-[960px]:text-accent max-[960px]:shadow-[0_0_0_3px_var(--accentLine),0_0_18px_-6px_var(--accent)]'

const FADE = 'motion-safe:transition-[color,background-color,border-color,box-shadow] motion-safe:duration-300'

/** The dotted track between two steps; `lit` once the highlight has passed it (phone). */
function Connector({ vertical, lit = false }: { vertical: boolean; lit?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={vertical ? 'w-3 h-full' : 'w-full h-3'}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
    >
      <line
        x1={vertical ? '50%' : '0'}
        y1={vertical ? '0' : '50%'}
        x2={vertical ? '50%' : '100%'}
        y2={vertical ? '100%' : '50%'}
        stroke={lit ? 'var(--accent)' : 'var(--muted)'}
        strokeWidth={2}
        strokeDasharray="4 4"
      />
    </svg>
  )
}

/**
 * "What happens when the strategy trades" — the actual path one signal
 * takes, with the customer's own account drawn as the place the money stays.
 * Every sentence is a rule the engine or the API enforces (deposit gate,
 * stack cap, sizing to balance, monthly invoice).
 *
 * WIDE SCREEN: static, every step in the page's brightest text colour (owner,
 * 2026-11-27: "the whole strip fixed and static… let's try white"); the one
 * colour is step 3 — a gold badge "Your money stays here" and a gold tile.
 *
 * PHONE (Dima, same day: "this card should be static but when you scroll the
 * yellow should go down each scroll"): the list pins to the middle of the
 * screen and every STEP_SCROLL_PX of scroll moves the gold down one step —
 * tile and title — lighting the dotted track behind it; then the page carries
 * on. The heading scrolls away first, so the five compact steps fit on the
 * screen. A screen too short for them is not pinned: the gold follows each
 * step past a reading line instead (`hooks/useScrollStep`). Step 3 keeps its
 * gold badge there; its tile turns gold when the highlight reaches it.
 */
export default function SignalFlow() {
  const { active, pinned, listRef, trackRef, itemRef } = useScrollStep(STEPS.length)

  return (
    <section className="border-t border-hair">
      <div className={`${CONTAINER} py-20 max-[560px]:py-14`}>
        <div className="max-w-[720px] mb-12 max-[960px]:mb-4" data-aos="fade-up">
          <h2 className={`${H2} mb-4`}>What happens when the strategy trades</h2>
          <p className={LEAD}>
            Every signal takes the same path, on every connected account. Nothing
            is pooled: each account trades on its own, sized to its own balance.
          </p>
        </div>

        {/* The pin (phones that fit it): a track one screen tall plus one
            scroll step per step, whose child sticks while the track passes. */}
        <div
          ref={trackRef}
          style={pinned ? { height: `calc(100svh + ${STEPS.length * STEP_SCROLL_PX}px)` } : undefined}
        >
          <div className={pinned ? 'sticky top-0 flex h-[100svh] items-center' : undefined}>
            <ol
              ref={listRef}
              className="grid w-full grid-cols-5 gap-0 pt-10 max-[960px]:grid-cols-1 max-[960px]:pt-0"
              data-aos="fade-up"
              data-aos-delay={80}
            >
              {STEPS.map((step, i) => {
                const on = i === active
                return (
                  <li
                    key={step.title}
                    ref={itemRef(i)}
                    className="relative flex flex-col max-[960px]:flex-row max-[960px]:gap-4"
                  >
                    {/* Tile row: the icon, then the track to the next step. */}
                    <div className="flex items-center max-[960px]:flex-col max-[960px]:items-center">
                      <div
                        className={`relative z-[1] flex h-16 w-16 shrink-0 items-center justify-center rounded-btn border border-muted bg-surface text-text max-[960px]:h-12 max-[960px]:w-12 ${FADE} ${
                          step.yours ? YOURS_TILE_WIDE : ''
                        } ${on ? ACTIVE_TILE_PHONE : ''}`}
                      >
                        <PixelIcon glyph={step.glyph} size={36} className="max-[960px]:h-7 max-[960px]:w-7" />
                        {step.yours && (
                          // Above the tile on a wide screen so every title stays on one line;
                          // above the title on a phone (below).
                          <span className={`${YOURS_BADGE} absolute bottom-full left-0 mb-2.5 inline-flex max-[960px]:hidden`}>
                            <PixelIcon glyph="lock" size={13} />
                            Your money stays here
                          </span>
                        )}
                      </div>
                      {i < GAPS && (
                        <>
                          <div className="flex-1 px-2 max-[960px]:hidden">
                            <Connector vertical={false} />
                          </div>
                          {/* Absolute, so the SVG takes the column's height instead of
                              adding its own default 150px to it. */}
                          <div className="hidden max-[960px]:block relative flex-1 w-3 min-h-4 my-1.5">
                            <div className="absolute inset-0">
                              <Connector vertical lit={i < active} />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="pt-5 pr-6 max-[960px]:pt-0.5 max-[960px]:pb-4 max-[960px]:pr-0">
                      {step.yours && (
                        <div className={`${YOURS_BADGE} hidden max-[960px]:inline-flex mb-2`}>
                          <PixelIcon glyph="lock" size={13} />
                          Your money stays here
                        </div>
                      )}
                      <h3
                        className={`font-display text-[17px] font-bold leading-[1.3] mb-2 text-text max-[960px]:mb-1 max-[960px]:text-[16px] motion-safe:transition-colors motion-safe:duration-300 ${
                          on ? 'max-[960px]:text-accent' : ''
                        }`}
                      >
                        {step.title}
                      </h3>
                      <p className="text-[14px] leading-[1.6] text-text/85 max-[960px]:text-[13.5px] max-[960px]:leading-[1.5]">
                        {step.body}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      </div>
    </section>
  )
}
