import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BadgePercent, Check, ChevronRight, ExternalLink, X } from 'lucide-react'
import AOS from 'aos'
import 'aos/dist/aos.css'
import Nav from '../components/landing/Nav'
import Footer from '../components/landing/Footer'
import FeeExample from '../components/binance-offer/FeeExample'
import OfferFaq from '../components/binance-offer/OfferFaq'
import ReferralCodeChip from '../components/binance-offer/ReferralCodeChip'
import {
  GUIDE_GHOST,
  GUIDE_PRIMARY,
  GUIDE_WRAP,
} from '../components/binance-guide/guideClasses'
import {
  BINANCE_REFERRAL_URL,
  DOES_NOT_QUALIFY,
  OFFER_FEE_PCT,
  OFFER_STEPS,
  QUALIFIES,
  STANDARD_FEE_PCT,
} from '../lib/binanceOffer'
import { REGISTER_PATH } from '../lib/routes'

const H2 =
  'font-display text-[32px] font-extrabold tracking-[-0.02em] leading-tight max-[560px]:text-[25px]'

function CreateAccountButton({ label = 'Create my Binance account' }: { label?: string }) {
  return (
    <a className={GUIDE_PRIMARY} href={BINANCE_REFERRAL_URL} target="_blank" rel="noreferrer noopener">
      {label}
      <ExternalLink size={14} />
    </a>
  )
}

/**
 * Public page behind the landing page's "Learn more": the Binance offer in
 * full — the rate, a worked month, who qualifies, how it is confirmed, and
 * what we earn from it. Nothing here is computed from data; every figure is
 * a constant in `lib/binanceOffer.ts`, shared with the guide.
 */
export default function BinanceOffer() {
  useEffect(() => {
    AOS.init({ duration: 700, once: true, offset: 80, easing: 'ease-out-cubic' })
    document.title = `Binance offer: pay ${OFFER_FEE_PCT}% — Pixel Alpha`
    if (!window.location.hash) window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="bg-[radial-gradient(circle_at_50%_-20%,var(--glow),transparent_55%)]">
        <Nav />

        <main>
          {/* Header + worked example */}
          <header
            className={`${GUIDE_WRAP} grid items-center gap-12 pt-14 pb-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] max-[560px]:pt-10 max-[560px]:pb-12`}
          >
            <div data-aos="fade-up">
              <div className="inline-flex items-center gap-2 rounded-pill border border-accent-line bg-accent-soft px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-widest text-accent">
                <BadgePercent size={13} />
                Offer · Binance
              </div>
              <h1 className="mt-5 font-display text-[50px] font-extrabold tracking-[-0.03em] leading-[1.03] max-[900px]:text-[36px]">
                New to Binance?
                <br />
                Pay <span className="text-accent">{OFFER_FEE_PCT}%</span> instead of{' '}
                {STANDARD_FEE_PCT}%.
              </h1>
              <p className="mt-6 max-w-[56ch] text-[16px] leading-[1.8] text-muted">
                Open your Binance account through our link and we lower our fee from{' '}
                {STANDARD_FEE_PCT}% to {OFFER_FEE_PCT}% of your profit — for as long as
                you trade with us. Same bot, same trades, more of the profit stays with you.
              </p>
              <div className="mt-7 flex flex-wrap gap-3 max-[560px]:flex-col max-[560px]:items-stretch">
                <CreateAccountButton />
                <Link to="/docs/binance" className={GUIDE_GHOST}>
                  Follow the setup guide
                  <ChevronRight size={15} />
                </Link>
              </div>
              <div className="mt-6">
                <ReferralCodeChip />
              </div>
            </div>

            <div data-aos="fade-up" data-aos-delay="120">
              <FeeExample />
            </div>
          </header>

          <div className={`${GUIDE_WRAP} pb-24`}>
            {/* How it works */}
            <section data-aos="fade-up">
              <h2 className={H2}>How it works</h2>
              <ol className="mt-7 grid list-none gap-4 md:grid-cols-3">
                {OFFER_STEPS.map((step, i) => (
                  <li key={step.title} className="rounded-[20px] border border-border bg-surface px-6 py-7">
                    <div className="mb-4 font-mono text-[30px] font-semibold text-accent">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <h3 className="font-display text-[17px] font-bold leading-snug">{step.title}</h3>
                    <p className="mt-2 text-[14px] leading-[1.65] text-muted">{step.body}</p>
                  </li>
                ))}
              </ol>
            </section>

            {/* Who qualifies */}
            <section data-aos="fade-up" className="mt-16">
              <h2 className={H2}>Who qualifies</h2>
              <div className="mt-7 grid gap-4 md:grid-cols-2">
                <div className="rounded-card border border-border bg-surface p-6 max-[560px]:p-5">
                  <div className="font-display text-[16px] font-bold text-green">Qualifies</div>
                  <ul className="mt-4 flex flex-col gap-3">
                    {QUALIFIES.map((item) => (
                      <li key={item} className="flex gap-3 text-[14.5px] leading-[1.7] text-muted">
                        <Check size={16} className="mt-[4px] shrink-0 text-green" strokeWidth={3} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-card border border-border bg-surface p-6 max-[560px]:p-5">
                  <div className="font-display text-[16px] font-bold text-red">Does not qualify</div>
                  <ul className="mt-4 flex flex-col gap-3">
                    {DOES_NOT_QUALIFY.map((item) => (
                      <li key={item} className="flex gap-3 text-[14.5px] leading-[1.7] text-muted">
                        <X size={16} className="mt-[4px] shrink-0 text-red" strokeWidth={3} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* Questions */}
            <section data-aos="fade-up" className="mt-16">
              <h2 className={H2}>Questions</h2>
              <div className="mt-7">
                <OfferFaq />
              </div>
            </section>

            {/* Closing call to action */}
            <div
              data-aos="fade-up"
              className="mt-16 flex flex-wrap items-center justify-between gap-5 rounded-card border border-accent-line bg-accent-soft p-7 max-[560px]:p-5"
            >
              <div>
                <div className="font-display text-[20px] font-extrabold tracking-[-0.02em]">
                  Ready? Start with the Binance account.
                </div>
                <p className="mt-1.5 max-w-[56ch] text-[14.5px] leading-[1.7] text-muted">
                  Then follow the guide to secure it, add USDT and connect it. Already have
                  Binance? You can still join — at the standard {STANDARD_FEE_PCT}%.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 max-[560px]:w-full max-[560px]:flex-col max-[560px]:items-stretch">
                <Link to={REGISTER_PATH} className={GUIDE_GHOST}>
                  Register with Pixel Alpha
                </Link>
                <CreateAccountButton label="Create Binance account" />
              </div>
            </div>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
