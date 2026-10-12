import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, ChevronRight, PartyPopper, ShieldCheck, X } from 'lucide-react'
import AOS from 'aos'
import 'aos/dist/aos.css'
import Nav from '../components/landing/Nav'
import Footer from '../components/landing/Footer'
import GuideChecklist from '../components/binance-guide/GuideChecklist'
import GuidePartHeader from '../components/binance-guide/GuidePartHeader'
import GuideStepSection from '../components/binance-guide/GuideStepSection'
import {
  GUIDE_GHOST,
  GUIDE_PRIMARY,
  GUIDE_WRAP,
} from '../components/binance-guide/guideClasses'
import { useGuideProgress } from '../hooks/useGuideProgress'
import { CONNECT_STEPS, GUIDE_PARTS, MIN_DEPOSIT_USDT } from '../lib/binanceGuide'
import { OFFER_FEE_PCT, STANDARD_FEE_PCT } from '../lib/binanceOffer'
import { scrollToSection } from '../lib/scroll'

const TROUBLESHOOTING = [
  {
    q: 'I forgot to check the Referral ID',
    a: `Your account works with Pixel Alpha all the same — it just does not qualify for the Binance offer, so it is billed at the standard ${STANDARD_FEE_PCT}%.`,
  },
  {
    q: 'Binance is still checking my identity',
    a: 'API keys can only be made once Binance approves it. Binance emails you when it is done — come back to Part 2 then; your ticks are saved on this device.',
  },
  {
    q: 'I can’t tick “Enable Futures”',
    a: 'Either the key has no IP restriction yet — add our server IP first, then tick it (Part 2, step 6) — or the key was made before your Futures account was opened. In that case delete the key and create a new one (Part 2, steps 4–7).',
  },
  {
    q: 'The account says connected, but no trades arrive',
    a: 'Almost always the IP list: our server IP must be on the key, not your own. Add it on Binance, then press "Recheck" on the account card in your dashboard.',
  },
  {
    q: 'Binance rejected the key straight away',
    a: 'The key must be “System generated”. Self-generated (Ed25519 / RSA) keys cannot be used, and a key’s type cannot be changed — create a new System generated key.',
  },
  {
    q: 'I lost the Secret Key',
    a: 'Binance shows it only once. Delete the key on Binance, create a new one, and connect that one in your dashboard.',
  },
  {
    q: 'My balance shows, but nothing trades',
    a: `Check that your USDT is in the USDⓈ-M Futures wallet, not Spot (Part 2, step 2), and that you have moved in at least ${MIN_DEPOSIT_USDT} USDT in total.`,
  },
  {
    q: 'Binance deleted my key',
    a: 'Binance removes keys that can trade without an IP restriction. Create a new one and lock it to our server IP before you tick Enable Futures (Part 2, step 6).',
  },
]

/**
 * Public, unauthenticated Binance guide (footer → Resources → Binance Docs),
 * in two parts: Part 1 creates the Binance account — through our referral
 * link, which is the Binance offer — and Part 2 connects it. A reader who
 * already has Binance skips Part 1, and that choice is remembered.
 *
 * It is public on purpose: the question "what exactly will I have to do?" is
 * asked before signing up, and the honest answer — trade-only key, no
 * withdrawal permission — is the strongest part of the pitch. Every step is a
 * tick box so a reader bouncing between this page and Binance always knows
 * where they left off.
 */
export default function BinanceGuide() {
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null)
  const { done, toggle, reset, hasAccount, setHasAccount } = useGuideProgress()

  useEffect(() => {
    AOS.init({ duration: 700, once: true, offset: 80, easing: 'ease-out-cubic' })
    document.title = 'Binance setup guide — Pixel Alpha'
    if (!window.location.hash) window.scrollTo(0, 0)
  }, [])

  const close = useCallback(() => setZoom(null), [])

  useEffect(() => {
    if (!zoom) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoom, close])

  const isSkipped = (skippable?: boolean) => Boolean(skippable) && hasAccount
  /** Every step the reader is meant to do, in order, across both parts. */
  const visibleSteps = GUIDE_PARTS.filter((p) => !isSkipped(p.skippable)).flatMap((p) => p.steps)
  const allDone = visibleSteps.every((s) => done.includes(s.id))
  const started = visibleSteps.some((s) => done.includes(s.id))

  const nextOpen = (after = -1) =>
    visibleSteps.slice(after + 1).find((s) => !done.includes(s.id))

  /** Tick a step and move the reader on to the next one still open. */
  const completeAndNext = (id: string) => {
    toggle(id, true)
    const next = nextOpen(visibleSteps.findIndex((s) => s.id === id))
    scrollToSection(next ? `step-${next.id}` : 'step-finish')
  }

  const skipAccount = () => {
    setHasAccount(true)
    // After the skip renders, Part 2 sits where Part 1 was — scroll on the next frame.
    window.requestAnimationFrame(() => scrollToSection('part-connect'))
  }

  const showAccount = () => {
    setHasAccount(false)
    window.requestAnimationFrame(() => scrollToSection('part-account'))
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="bg-[radial-gradient(circle_at_50%_-20%,var(--glow),transparent_55%)]">
        <Nav />

        <main className="relative">
          {/* Header */}
          <header className={`${GUIDE_WRAP} pt-14 pb-10 max-[560px]:pt-10`} data-aos="fade-up">
            <div className="inline-flex items-center gap-2 rounded-pill border border-accent-line bg-accent-soft px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-widest text-accent">
              <BookOpen size={13} />
              Docs · Binance
            </div>
            <h1 className="font-display text-[46px] font-extrabold tracking-[-0.03em] leading-[1.05] mt-5 max-[900px]:text-[34px]">
              Set up Binance and connect it to Pixel Alpha
            </h1>
            <p className="mt-6 max-w-[70ch] border-l-2 border-accent pl-5 text-[15.5px] leading-[1.8] text-muted">
              New to Binance? Part 1 creates your account — and through our link
              you pay {OFFER_FEE_PCT}% of your profit instead of {STANDARD_FEE_PCT}%.
              Already have one? Go straight to Part 2: {CONNECT_STEPS.length} short
              steps, about ten minutes. Tick each step off as you finish it — your
              progress is saved on this device. Your money stays in your own
              Binance account the whole time.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 max-[560px]:flex-col max-[560px]:items-stretch">
              {started && !allDone ? (
                <button
                  type="button"
                  className={GUIDE_PRIMARY}
                  onClick={() => {
                    const next = nextOpen()
                    scrollToSection(next ? `step-${next.id}` : 'step-finish')
                  }}
                >
                  Continue where I left off
                  <ChevronRight size={15} />
                </button>
              ) : (
                <button type="button" className={GUIDE_PRIMARY} onClick={showAccount}>
                  I’m new to Binance
                  <ChevronRight size={15} />
                </button>
              )}
              <button type="button" className={GUIDE_GHOST} onClick={skipAccount}>
                I already have Binance
              </button>
            </div>
          </header>

          <div className={`${GUIDE_WRAP} pb-24`}>
            {/* Before you start */}
            <div
              data-aos="fade-up"
              className="flex gap-4 rounded-card border border-border bg-surface p-6 max-[560px]:p-5"
            >
              <ShieldCheck size={20} className="mt-0.5 shrink-0 text-green" />
              <div>
                <div className="font-display text-[17px] font-bold">Before you start</div>
                <ul className="mt-3 flex flex-col gap-2.5">
                  {[
                    'A Binance account with two-factor security and a verified identity — Binance does not let unverified accounts create API keys. No account yet? Part 1 walks you through it.',
                    `At least ${MIN_DEPOSIT_USDT} USDT to put in your Futures wallet. Below that, the bot will not open trades for you.`,
                    'The key you make can only place and close trades. It cannot withdraw, transfer or convert your funds.',
                    'You can delete the key on Binance at any time, and our access ends the moment you do.',
                  ].map((item) => (
                    <li key={item} className="flex gap-3 text-[15px] leading-[1.7] text-muted">
                      <span
                        aria-hidden
                        className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-10 lg:grid lg:grid-cols-[290px_minmax(0,1fr)] lg:gap-12">
              {/* Checklist — above the steps on mobile, sticky beside them on desktop */}
              <aside className="lg:sticky lg:top-6 lg:self-start">
                <GuideChecklist
                  parts={GUIDE_PARTS}
                  done={done}
                  hasAccount={hasAccount}
                  toggle={(id) => toggle(id)}
                  reset={reset}
                  onShowAccount={showAccount}
                />
              </aside>

              {/* Parts and their steps */}
              <article className="max-lg:mt-12">
                {GUIDE_PARTS.map((part) => {
                  const skipped = isSkipped(part.skippable)
                  return (
                    <div key={part.id} className="mb-16 last:mb-0">
                      <GuidePartHeader
                        part={part}
                        skipped={skipped}
                        onSkip={skipAccount}
                        onShow={showAccount}
                      />
                      {!skipped &&
                        part.steps.map((step, i) => (
                          <GuideStepSection
                            key={step.id}
                            step={step}
                            index={i}
                            total={part.steps.length}
                            partLabel={part.label}
                            checked={done.includes(step.id)}
                            isLast={step.id === visibleSteps[visibleSteps.length - 1]?.id}
                            onToggle={(value) => toggle(step.id, value)}
                            onCompleteAndNext={() => completeAndNext(step.id)}
                            onZoom={setZoom}
                          />
                        ))}
                    </div>
                  )
                })}

                {/* Finish */}
                <div
                  id="step-finish"
                  className={`scroll-mt-8 mt-12 flex flex-wrap items-center justify-between gap-5 rounded-card border p-7 max-[560px]:p-5 ${
                    allDone ? 'border-green bg-surface' : 'border-border bg-surface'
                  }`}
                >
                  <div className="flex gap-4">
                    {allDone && <PartyPopper size={22} className="mt-1 shrink-0 text-green" />}
                    <div>
                      <div className="font-display text-[20px] font-extrabold tracking-[-0.02em]">
                        {allDone ? 'All done — you’re connected' : 'Key ready?'}
                      </div>
                      <p className="mt-1.5 max-w-[52ch] text-[14.5px] leading-[1.7] text-muted">
                        {allDone
                          ? 'Your account card on Exchange Accounts shows your balance within a few minutes. If it says the key is blocked, open it — it tells you exactly what to fix.'
                          : 'Connect it in your dashboard. You can also try a Binance testnet key first and watch the bot run on play money.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link to="/trading-bot" className={GUIDE_GHOST}>
                      How the bot works
                    </Link>
                    <Link
                      to={allDone ? '/dashboard/exchanges' : '/dashboard/exchanges/connect'}
                      className={GUIDE_PRIMARY}
                    >
                      {allDone ? 'Go to my exchanges' : 'Connect Binance'}
                      <ChevronRight size={15} />
                    </Link>
                  </div>
                </div>
              </article>
            </div>

            {/* Troubleshooting */}
            <section data-aos="fade-up" className="mt-14 border-t border-hair pt-10">
              <h2 className="font-display text-[26px] font-extrabold tracking-[-0.02em] leading-tight max-[560px]:text-[22px]">
                If something is not working
              </h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {TROUBLESHOOTING.map((item) => (
                  <div key={item.q} className="rounded-card border border-border bg-surface p-5">
                    <div className="font-display text-[15.5px] font-bold">{item.q}</div>
                    <p className="mt-2 text-[14.5px] leading-[1.7] text-muted">{item.a}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* Screenshot lightbox */}
      {zoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-[fadeup_0.2s_ease-out]"
          onClick={close}
          role="presentation"
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full border border-border bg-surface text-text transition-colors hover:border-accent"
          >
            <X size={18} />
          </button>
          <img
            src={zoom.src}
            alt={zoom.alt}
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-auto max-w-[92vw] rounded-card object-contain shadow-2xl"
          />
        </div>
      )}

      <Footer />
    </div>
  )
}
