import { MIN_DEPOSIT_USDT } from '../../lib/pricing'
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

/** The dotted track between two steps. */
function Connector({ vertical }: { vertical: boolean }) {
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
        stroke="var(--muted)"
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
 * Static, and every step in the page's brightest text colour (owner,
 * 2026-11-27: "the whole strip fixed and static… let's try white"). A day
 * earlier it had a gold highlight that moved from step to step as you
 * scrolled, then a version that held the strip still while the gold moved;
 * both are in git history (`useScrollStep`, `lib/scrollStep`) if the owner
 * wants one back. The one colour left is the gold "Your money stays here".
 */
export default function SignalFlow() {
  return (
    <section className="border-t border-hair">
      <div className={`${CONTAINER} py-20 max-[560px]:py-14`}>
        <div className="max-w-[720px] mb-12" data-aos="fade-up">
          <h2 className={`${H2} mb-4`}>What happens when the strategy trades</h2>
          <p className={LEAD}>
            Every signal takes the same path, on every connected account. Nothing
            is pooled: each account trades on its own, sized to its own balance.
          </p>
        </div>

        <ol
          className="grid grid-cols-5 gap-0 pt-7 max-[960px]:grid-cols-1 max-[960px]:pt-0"
          data-aos="fade-up"
          data-aos-delay={80}
        >
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative flex flex-col max-[960px]:flex-row max-[960px]:gap-5">
              {/* Tile row: the icon, then the track to the next step. */}
              <div className="flex items-center max-[960px]:flex-col max-[960px]:items-center">
                <div className="relative z-[1] flex h-16 w-16 shrink-0 items-center justify-center rounded-btn border border-muted bg-surface text-text">
                  <PixelIcon glyph={step.glyph} size={36} />
                  {step.yours && (
                    // Above the tile on a wide screen so every title stays on one line;
                    // beside the text on a phone (below).
                    <span className="absolute bottom-full left-0 mb-2.5 inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[11px] font-semibold text-accent max-[960px]:hidden">
                      <PixelIcon glyph="lock" size={12} />
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
                    <div className="hidden max-[960px]:block relative flex-1 w-3 min-h-8 my-2">
                      <div className="absolute inset-0">
                        <Connector vertical />
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="pt-5 pr-6 max-[960px]:pt-1 max-[960px]:pb-8 max-[960px]:pr-0">
                {step.yours && (
                  <div className="hidden max-[960px]:inline-flex items-center gap-1.5 mb-2 font-mono text-[11px] font-semibold text-accent">
                    <PixelIcon glyph="lock" size={12} />
                    Your money stays here
                  </div>
                )}
                <h3 className="font-display text-[17px] font-bold leading-[1.3] mb-2 text-text">{step.title}</h3>
                <p className="text-[14px] leading-[1.6] text-text/85">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
