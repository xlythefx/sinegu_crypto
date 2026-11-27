import { Link } from 'react-router-dom'
import { useSessionUser } from '../../hooks/useSessionUser'
import { scrollToSection } from '../../lib/scroll'
import { REGISTER_PATH } from '../../lib/routes'
import ExchangeLogo from '../exchanges/ExchangeLogo'
import PixelOrderBook from './PixelOrderBook'
import { VENUES } from './venues'
import { BTN_PRIMARY, BTN_SECONDARY, CONTAINER, LANDING_IDS } from './layout'

/**
 * Says what the product is in plain words, then the one thing that sets the
 * pricing apart (billed only on a new high — the high-water mark, without the
 * jargon). No percentage here on purpose: the fee section states the exact
 * rates once, instead of the old page's "20%" six times over.
 *
 * "Your own exchange account", not "your own Binance account": the product
 * runs on Binance, Bybit and MEXC. The badges under the buttons say which of
 * them a customer can connect TODAY, from the connect page's own switch, so
 * the headline never promises a venue that is still closed.
 *
 * The live order book stays (real Binance data, the one hero element that
 * was never a template), drawn as pixel art. The backdrop is the photo the
 * classic page used, as a pixel mosaic (`HeroPhoto`, rendered by the page
 * behind both the nav and this section).
 *
 * Pixel, the mascot from Admin → Creatives → Character, sits on the order
 * book's top edge (owner, 2026-11-27). The picture is his stored reference
 * image cut out of its backdrop, with the legs shortened so they hang down the
 * box's front; `PIXEL_SEAT` is where his seat falls in that picture, so the
 * seat lands on the edge at any width. The order book keeps a clear band at
 * its top for his feet, so they never cover its header. The column is padded by his height
 * above the edge, so he never covers the nav or the buttons above.
 */

/** His seat line, as a share of the picture's height (measured on the file). */
const PIXEL_SEAT = 0.834
export default function HeroNext() {
  const user = useSessionUser()
  return (
    <section className="relative">
      <div
        className={`${CONTAINER} relative pt-12 pb-20 grid grid-cols-[1.1fr_0.9fr] gap-14 items-center max-[960px]:grid-cols-1 max-[960px]:gap-10 max-[560px]:pt-6 max-[560px]:pb-14`}
      >
        <div className="animate-[fadeup_0.7s_cubic-bezier(0.2,0.7,0.2,1)_both]">
          <h1 className="font-display text-[54px] leading-[1.04] font-extrabold tracking-[-0.03em] mb-6 max-[960px]:text-[44px] max-[560px]:text-[34px]">
            Automated futures trading on your own exchange account.
          </h1>
          {/* Lighter than the usual muted grey: it sits on the photo. */}
          <p className="text-[18px] leading-[1.6] text-text/80 max-w-[52ch] mb-8 max-[560px]:text-[16.5px]">
            Our strategy decides when to buy and sell, and our engine places the
            orders on your account, day and night. Your money never leaves your
            exchange. You pay only out of profit, and only for a month that ends
            with your account at a new high.
          </p>
          <div className="flex gap-3 flex-wrap">
            {user ? (
              <Link to="/dashboard" className={`${BTN_PRIMARY} no-underline`}>
                Open your dashboard
              </Link>
            ) : (
              <Link to={REGISTER_PATH} className={`${BTN_PRIMARY} no-underline`}>
                Create an account
              </Link>
            )}
            <button
              type="button"
              className={BTN_SECONDARY}
              onClick={() => scrollToSection(LANDING_IDS.latestTrades)}
            >
              See the latest trades
            </button>
          </div>

          <ul className="mt-8 mb-0 pl-0 list-none flex flex-wrap items-center gap-2.5" aria-label="Supported exchanges">
            {VENUES.map((v) => (
              <li
                key={v.kind}
                className={`inline-flex items-center gap-2 min-h-9 py-1.5 pl-1.5 pr-3 rounded-[6px] border bg-surface ${
                  v.open ? 'border-border' : 'border-hair'
                }`}
              >
                <ExchangeLogo kind={v.kind} size={22} className={v.open ? '' : 'opacity-60'} />
                <span className={`text-[14px] font-semibold ${v.open ? 'text-text' : 'text-muted'}`}>{v.label}</span>
                {v.open ? (
                  <span className="inline-flex items-center gap-1 font-pixel text-[10px] text-green">
                    <span aria-hidden="true" className="h-[6px] w-[6px] bg-green" />
                    Live
                  </span>
                ) : (
                  <span className="font-pixel text-[10px] text-faint">Soon</span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative pt-[104px] max-[560px]:pt-[84px] animate-[fadeup_0.7s_cubic-bezier(0.2,0.7,0.2,1)_0.12s_both]">
          <div className="relative">
            <PixelOrderBook />
            <img
              src="/assets/pixel-mascot-sitting.png"
              alt=""
              aria-hidden="true"
              width={264}
              height={413}
              decoding="async"
              className="absolute top-0 right-[84px] z-[1] h-auto w-[88px] pointer-events-none select-none max-[560px]:right-[72px] max-[560px]:w-[72px]"
              style={{ transform: `translateY(-${PIXEL_SEAT * 100}%)` }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
