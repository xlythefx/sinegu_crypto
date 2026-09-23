import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Bot, ChevronRight } from 'lucide-react'
import AOS from 'aos'
import 'aos/dist/aos.css'
import Nav from '../components/landing/Nav'
import Footer from '../components/landing/Footer'
import LegalDocument from '../components/legal/LegalDocument'
import { TRADING_BOT } from '../lib/tradingBot'
import { REGISTER_PATH } from '../lib/routes'

export default function TradingBot() {
  useEffect(() => {
    AOS.init({ duration: 700, once: true, offset: 80, easing: 'ease-out-cubic' })
    document.title = `${TRADING_BOT.title} — Pixel Alpha`
    // Same rule as the Terms page: a footer link must land at the top, but a
    // deep link to a clause (#pricing) must still reach it.
    if (!window.location.hash) window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="bg-[radial-gradient(circle_at_50%_-20%,var(--glow),transparent_55%)]">
        <Nav />
        <LegalDocument
          doc={TRADING_BOT}
          eyebrow="Product · Pixel Alpha"
          icon={Bot}
        />

        <div className="max-w-[1280px] mx-auto px-10 max-[560px]:px-5 pb-24">
          <div
            data-aos="fade-up"
            className="flex flex-wrap items-center justify-between gap-5 rounded-card border border-accent-line bg-accent-soft p-7 max-[560px]:p-5"
          >
            <div>
              <div className="font-display text-[20px] font-extrabold tracking-[-0.02em]">
                Ready to connect Binance?
              </div>
              <p className="mt-1.5 max-w-[52ch] text-[14.5px] leading-[1.7] text-muted">
                The guide walks through every screen — creating the key, the
                signature type, the IP allow-list and funding your futures
                wallet.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/docs/binance"
                className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface px-5 py-3 text-[14px] font-bold text-text transition-colors hover:border-accent"
              >
                Read the Binance guide
                <ChevronRight size={15} />
              </Link>
              <Link
                to={REGISTER_PATH}
                className="inline-flex items-center gap-2 rounded-pill bg-accent px-5 py-3 text-[14px] font-bold text-white transition-transform hover:-translate-y-px"
              >
                Register
              </Link>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
