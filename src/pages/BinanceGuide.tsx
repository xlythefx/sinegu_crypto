import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  ShieldCheck,
  TriangleAlert,
  Wallet,
  X,
  ZoomIn,
} from 'lucide-react'
import AOS from 'aos'
import 'aos/dist/aos.css'
import Nav from '../components/landing/Nav'
import Footer from '../components/landing/Footer'
import { GUIDE_STEPS, MIN_DEPOSIT_USDT } from '../lib/binanceGuide'
import { FALLBACK_SERVER_IP } from '../lib/serverIp'

const WRAP = 'max-w-[1280px] mx-auto px-10 max-[560px]:px-5'

/** Renders `**bold**` spans; nothing else in the guide copy is parsed. */
function withBold(text: string) {
  return text
    .split('**')
    .map((part, i) =>
      i % 2 === 1 ? (
        <strong key={i} className="font-bold text-text">
          {part}
        </strong>
      ) : (
        part
      ),
    )
}

function IpBlock() {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(FALLBACK_SERVER_IP)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the address is selectable in place */
    }
  }

  return (
    <div className="my-5 rounded-card border border-accent-line bg-accent-soft p-4">
      <div className="font-mono text-[11px] uppercase tracking-widest text-faint">
        Pixel Alpha server IP
      </div>
      <div className="mt-2.5 flex items-center gap-3">
        <code className="min-w-0 flex-1 break-all font-mono text-[17px] font-bold tracking-[0.02em] text-text">
          {FALLBACK_SERVER_IP}
        </code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex flex-none items-center gap-1.5 rounded-btn border border-border bg-surface px-3 py-2 text-[12px] font-bold text-text transition-colors hover:border-accent"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

/**
 * Public, unauthenticated walkthrough for creating a Binance API key and
 * connecting it to Pixel Alpha (footer → Resources → Binance Docs).
 *
 * It is public on purpose: the question "what exactly will I have to do?" is
 * asked before signing up, and the honest answer — trade-only key, no
 * withdrawal permission — is the strongest part of the pitch.
 */
export default function BinanceGuide() {
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null)

  useEffect(() => {
    AOS.init({ duration: 700, once: true, offset: 80, easing: 'ease-out-cubic' })
    document.title = 'How to connect Binance — Pixel Alpha'
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

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="bg-[radial-gradient(circle_at_50%_-20%,var(--glow),transparent_55%)]">
        <Nav />

        <main className="relative">
          {/* Header */}
          <header className={`${WRAP} pt-14 pb-10 max-[560px]:pt-10`} data-aos="fade-up">
            <div className="inline-flex items-center gap-2 rounded-pill border border-accent-line bg-accent-soft px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-widest text-accent">
              <BookOpen size={13} />
              Docs · Binance
            </div>
            <h1 className="font-display text-[46px] font-extrabold tracking-[-0.03em] leading-[1.05] mt-5 max-[900px]:text-[34px]">
              How to connect your Binance account
            </h1>
            <p className="mt-6 max-w-[70ch] border-l-2 border-accent pl-5 text-[15.5px] leading-[1.8] text-muted">
              Five steps on Binance’s own screens: create an API key, give it
              trading permission only, allow-list our server, and move USDT into
              your futures wallet. It takes about ten minutes, and your funds
              never leave your account.
            </p>
            <a
              className="mt-6 inline-flex items-center gap-2 rounded-pill bg-accent px-5 py-3 text-[14px] font-bold text-white transition-transform hover:-translate-y-px"
              href="https://www.binance.com/en/my/settings/api-management"
              target="_blank"
              rel="noreferrer noopener"
            >
              Open Binance API Management
              <ExternalLink size={14} />
            </a>
          </header>

          <div className={`${WRAP} pb-24`}>
            {/* Before you start */}
            <div
              data-aos="fade-up"
              className="flex gap-4 rounded-card border border-border bg-surface p-6 max-[560px]:p-5"
            >
              <ShieldCheck size={20} className="mt-0.5 shrink-0 text-green" />
              <div>
                <div className="font-display text-[17px] font-bold">
                  Before you start
                </div>
                <ul className="mt-3 flex flex-col gap-2.5">
                  {[
                    'You need a verified Binance account that is allowed to trade futures in your country.',
                    `You need at least ${MIN_DEPOSIT_USDT} USDT of deposited capital in your USD-M Futures wallet — below that, the bot will not open a position for you.`,
                    'The key you create gives us permission to place and close trades. It gives us no way to withdraw, transfer or convert your funds.',
                    'You can revoke the key on Binance at any moment, and our access ends the instant you do.',
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex gap-3 text-[15px] leading-[1.7] text-muted"
                    >
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

            {/* Steps */}
            <article>
              {GUIDE_STEPS.map((step) => (
                <section
                  key={step.number}
                  id={`step-${step.number}`}
                  data-aos="fade-up"
                  className="scroll-mt-8 border-t border-hair pt-10 mt-10"
                >
                  <div className="flex items-baseline gap-3.5">
                    <span className="font-mono text-[13px] text-accent">
                      {String(step.number).padStart(2, '0')}
                    </span>
                    <h2 className="font-display text-[26px] font-extrabold tracking-[-0.02em] leading-tight max-[560px]:text-[22px]">
                      {step.title}
                    </h2>
                  </div>

                  <div className="mt-4 max-w-[76ch]">
                    {step.body.map((para, i) => (
                      <p
                        key={i}
                        className="my-4 text-[15px] leading-[1.8] text-muted first:mt-0"
                      >
                        {withBold(para)}
                      </p>
                    ))}

                    {step.ip && <IpBlock />}

                    {step.warning && (
                      <div className="my-4 flex gap-3.5 rounded-card border border-accent-line bg-accent-soft p-5 max-[560px]:p-4">
                        <TriangleAlert
                          size={18}
                          className="mt-0.5 shrink-0 text-accent"
                        />
                        <p className="text-[15px] leading-[1.75] text-text">
                          {step.warning}
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setZoom({
                        src: step.image,
                        alt: `Step ${step.number}: ${step.title}`,
                      })
                    }
                    className="group relative mt-6 block w-full max-w-[820px] cursor-zoom-in overflow-hidden rounded-card border border-border bg-surface2 transition-colors hover:border-accent"
                  >
                    <img
                      src={step.image}
                      alt={`Step ${step.number}: ${step.title}`}
                      loading="lazy"
                      className="h-auto w-full object-contain"
                    />
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface/90 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-muted opacity-0 transition-opacity group-hover:opacity-100">
                      <ZoomIn size={12} />
                      Zoom
                    </span>
                  </button>
                </section>
              ))}
            </article>

            {/* Funding requirement */}
            <div
              data-aos="fade-up"
              className="mt-12 flex gap-4 rounded-card border border-accent-line bg-accent-soft p-6 max-[560px]:p-5"
            >
              <Wallet size={20} className="mt-0.5 shrink-0 text-accent" />
              <div>
                <div className="font-display text-[17px] font-bold">
                  Funding requirement
                </div>
                <p className="mt-2 text-[15px] leading-[1.75] text-muted">
                  Keep at least{' '}
                  <strong className="font-bold text-text">
                    {MIN_DEPOSIT_USDT} USDT
                  </strong>{' '}
                  in your{' '}
                  <strong className="font-bold text-text">
                    USD-M Futures wallet
                  </strong>
                  . The bot will not open a position for an account below that —
                  order sizes would fall under Binance’s own minimums and a
                  single trade would be a disproportionate share of the account.
                  The check is on capital you deposited, not on your current
                  balance, so a drawdown does not switch your bot off.
                </p>
              </div>
            </div>

            {/* Troubleshooting */}
            <section
              data-aos="fade-up"
              className="mt-10 border-t border-hair pt-10"
            >
              <h2 className="font-display text-[26px] font-extrabold tracking-[-0.02em] leading-tight max-[560px]:text-[22px]">
                If something is not working
              </h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {[
                  {
                    q: 'The account says connected, but no trades arrive',
                    a: 'Almost always the IP allow-list. If the key is restricted to trusted IPs, our server address must be on that list. Add it on Binance, then press "Recheck" on the account card in your dashboard — a real round trip to Binance is what settles the verdict.',
                  },
                  {
                    q: 'Binance rejected the key immediately',
                    a: 'Check the signature type. The key must be HMAC (system generated); Ed25519 and RSA keys cannot be used. Create a fresh HMAC key — an existing key’s type cannot be changed.',
                  },
                  {
                    q: 'I lost the secret key',
                    a: 'Binance shows it only once, at creation. There is no way to retrieve it. Delete the key on Binance and create a new one, then reconnect it in your dashboard.',
                  },
                  {
                    q: 'My balance shows but nothing trades',
                    a: 'Confirm the funds are in the USD-M Futures wallet rather than Spot, and that the deposited total is at or above the minimum. Both are visible on your exchange account card.',
                  },
                ].map((item) => (
                  <div
                    key={item.q}
                    className="rounded-card border border-border bg-surface p-5"
                  >
                    <div className="font-display text-[15.5px] font-bold">
                      {item.q}
                    </div>
                    <p className="mt-2 text-[14.5px] leading-[1.7] text-muted">
                      {item.a}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* CTA */}
            <div
              data-aos="fade-up"
              className="mt-12 flex flex-wrap items-center justify-between gap-5 rounded-card border border-border bg-surface p-7 max-[560px]:p-5"
            >
              <div>
                <div className="font-display text-[20px] font-extrabold tracking-[-0.02em]">
                  Key ready?
                </div>
                <p className="mt-1.5 max-w-[52ch] text-[14.5px] leading-[1.7] text-muted">
                  Connect it in your dashboard — exchange, mode, keys, review.
                  You can also connect a Binance testnet key first and watch the
                  bot run on play money.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to="/trading-bot"
                  className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface2 px-5 py-3 text-[14px] font-bold text-text transition-colors hover:border-accent"
                >
                  How the bot works
                </Link>
                <Link
                  to="/dashboard/exchanges/connect"
                  className="inline-flex items-center gap-2 rounded-pill bg-accent px-5 py-3 text-[14px] font-bold text-white transition-transform hover:-translate-y-px"
                >
                  Connect Binance
                  <ChevronRight size={15} />
                </Link>
              </div>
            </div>
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
