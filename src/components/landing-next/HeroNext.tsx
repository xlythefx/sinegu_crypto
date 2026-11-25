import { Link } from 'react-router-dom'
import { useSessionUser } from '../../hooks/useSessionUser'
import { scrollToSection } from '../../lib/scroll'
import { REGISTER_PATH } from '../../lib/routes'
import OrderBook from '../landing/OrderBook'
import PixelField from './PixelField'
import { BTN_PRIMARY, BTN_SECONDARY, CONTAINER, LANDING_IDS } from './layout'

/**
 * Says what the product is in plain words, then the one thing that sets the
 * pricing apart (billed only on a new high — the high-water mark, without the
 * jargon). No percentage here on purpose: the fee section states the exact
 * rates once, instead of the old page's "20%" six times over.
 *
 * The live order book stays: it is real Binance data, the one hero element
 * that was never a template.
 */
export default function HeroNext() {
  const user = useSessionUser()
  return (
    <section className="relative">
      <PixelField />
      <div
        className={`${CONTAINER} relative pt-12 pb-16 grid grid-cols-[1.1fr_0.9fr] gap-14 items-center max-[960px]:grid-cols-1 max-[960px]:gap-10 max-[560px]:pt-6`}
      >
        <div className="animate-[fadeup_0.7s_cubic-bezier(0.2,0.7,0.2,1)_both]">
          <h1 className="font-display text-[54px] leading-[1.04] font-extrabold tracking-[-0.03em] mb-6 max-[960px]:text-[44px] max-[560px]:text-[34px]">
            Automated futures trading on your own Binance account.
          </h1>
          <p className="text-[18px] leading-[1.6] text-muted max-w-[52ch] mb-8 max-[560px]:text-[16.5px]">
            Our strategy decides when to buy and sell, and our engine places the
            orders on your account, day and night. Your money never leaves
            Binance. You pay only out of profit, and only for a month that ends
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
        </div>
        <div className="relative animate-[fadeup_0.7s_cubic-bezier(0.2,0.7,0.2,1)_0.12s_both]">
          <OrderBook />
        </div>
      </div>
    </section>
  )
}
