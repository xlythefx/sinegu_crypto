import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Lightbulb,
  PartyPopper,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  X,
  ZoomIn,
} from 'lucide-react'
import AOS from 'aos'
import 'aos/dist/aos.css'
import Nav from '../components/landing/Nav'
import Footer from '../components/landing/Footer'
import {
  API_MANAGEMENT_URL,
  GUIDE_STEPS,
  MIN_DEPOSIT_USDT,
  type GuideStep,
} from '../lib/binanceGuide'
import { FALLBACK_SERVER_IP } from '../lib/serverIp'

const WRAP = 'max-w-[1280px] mx-auto px-10 max-[560px]:px-5'
const PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-pill bg-accent px-5 py-3 text-[14px] font-bold text-white transition-transform hover:-translate-y-px'
const GHOST =
  'inline-flex items-center justify-center gap-2 rounded-pill border border-border bg-surface2 px-5 py-3 text-[14px] font-bold text-text transition-colors hover:border-accent'

/** Where the reader's ticks live — this device only, a convenience. */
const PROGRESS_KEY = 'pa-binance-guide-done'

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

/**
 * Ticked-off steps, remembered on this device so a reader who leaves for
 * Binance mid-way comes back to where they were. Storage can be missing or
 * throw (private window, blocked site data) — the page works without it.
 */
function useGuideProgress() {
  const [done, setDone] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(PROGRESS_KEY)
      const ids = raw ? (JSON.parse(raw) as unknown) : []
      return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(done))
    } catch {
      /* storage unavailable — progress lasts for this visit only */
    }
  }, [done])

  const toggle = useCallback((id: string, value?: boolean) => {
    setDone((prev) => {
      const on = value ?? !prev.includes(id)
      return on ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)
    })
  }, [])

  const reset = useCallback(() => setDone([]), [])

  return { done, toggle, reset }
}

function scrollToStep(id: string) {
  document.getElementById(`step-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
        Pixel Alpha server IP — paste this
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

/** The round tick box — a real checkbox to assistive tech. */
function TickBox({
  checked,
  onToggle,
  label,
  size = 'md',
  number,
}: {
  checked: boolean
  onToggle: () => void
  label: string
  size?: 'sm' | 'md'
  number?: number
}) {
  const dims = size === 'md' ? 'h-10 w-10 text-[14px]' : 'h-6 w-6 text-[11px]'
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={`grid flex-none place-items-center rounded-full border-2 font-mono font-bold transition-colors duration-150 ${dims} ${
        checked
          ? 'border-green bg-green text-white'
          : 'border-border bg-surface2 text-accent hover:border-accent'
      }`}
    >
      {checked ? <Check size={size === 'md' ? 18 : 13} strokeWidth={3} /> : number}
    </button>
  )
}

function Checklist({
  done,
  toggle,
  reset,
}: {
  done: string[]
  toggle: (id: string) => void
  reset: () => void
}) {
  const count = GUIDE_STEPS.filter((s) => done.includes(s.id)).length
  const pct = Math.round((count / GUIDE_STEPS.length) * 100)

  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-display text-[16px] font-bold">Your checklist</div>
        <div className="font-mono text-[12px] text-muted">
          {count} of {GUIDE_STEPS.length} done
        </div>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-surface2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={GUIDE_STEPS.length}
        aria-valuenow={count}
        aria-label="Steps completed"
      >
        <div
          className="h-full rounded-full bg-green transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className="mt-4 flex flex-col gap-1">
        {GUIDE_STEPS.map((step, i) => {
          const checked = done.includes(step.id)
          return (
            <li key={step.id} className="flex items-center gap-3 rounded-field px-1.5 py-1.5">
              <TickBox
                size="sm"
                checked={checked}
                number={i + 1}
                onToggle={() => toggle(step.id)}
                label={`Step ${i + 1}: ${step.title}`}
              />
              <button
                type="button"
                onClick={() => scrollToStep(step.id)}
                className={`min-w-0 text-left text-[13.5px] leading-snug transition-colors hover:text-accent ${
                  checked ? 'text-faint line-through' : 'text-text'
                }`}
              >
                {step.title}
              </button>
            </li>
          )
        })}
      </ol>

      {count > 0 && (
        <button
          type="button"
          onClick={reset}
          className="mt-3 inline-flex items-center gap-1.5 px-1.5 text-[12px] font-semibold text-muted transition-colors hover:text-text"
        >
          <RotateCcw size={12} />
          Start over
        </button>
      )}
    </div>
  )
}

function StepLink({ link }: { link: NonNullable<GuideStep['link']> }) {
  if (link.to) {
    return (
      <Link to={link.to} className={PRIMARY}>
        {link.label}
        <ChevronRight size={15} />
      </Link>
    )
  }
  return (
    <a className={GHOST} href={link.href} target="_blank" rel="noreferrer noopener">
      {link.label}
      <ExternalLink size={14} />
    </a>
  )
}

/**
 * Public, unauthenticated walkthrough for creating a Binance API key and
 * connecting it to Pixel Alpha (footer → Resources → Binance Docs).
 *
 * It is public on purpose: the question "what exactly will I have to do?" is
 * asked before signing up, and the honest answer — trade-only key, no
 * withdrawal permission — is the strongest part of the pitch. Every step is a
 * tick box so a reader bouncing between this page and Binance always knows
 * where they left off.
 */
export default function BinanceGuide() {
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null)
  const { done, toggle, reset } = useGuideProgress()

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

  const allDone = GUIDE_STEPS.every((s) => done.includes(s.id))

  /** Tick a step and move the reader on to the next one still open. */
  const completeAndNext = (index: number) => {
    const step = GUIDE_STEPS[index]
    toggle(step.id, true)
    const next = GUIDE_STEPS.slice(index + 1).find((s) => !done.includes(s.id))
    scrollToStep(next ? next.id : 'finish')
  }

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
              {GUIDE_STEPS.length} short steps, about ten minutes. Keep this page
              open beside Binance and tick each step off as you finish it — your
              progress is saved on this device. Your money stays in your own
              Binance account the whole time.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className={PRIMARY}
                onClick={() => {
                  const next = GUIDE_STEPS.find((s) => !done.includes(s.id))
                  scrollToStep(next ? next.id : 'finish')
                }}
              >
                {done.length > 0 && !allDone ? 'Continue where I left off' : 'Start step 1'}
                <ChevronRight size={15} />
              </button>
              <a
                className={GHOST}
                href={API_MANAGEMENT_URL}
                target="_blank"
                rel="noreferrer noopener"
              >
                Open Binance API Management
                <ExternalLink size={14} />
              </a>
            </div>
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
                    'A verified (KYC) Binance account — Binance does not let unverified accounts create API keys.',
                    `At least ${MIN_DEPOSIT_USDT} USDT to put in your Futures wallet. Below that, the bot will not open trades for you.`,
                    'The key you make can only place and close trades. It cannot withdraw, transfer or convert your funds.',
                    'You can delete the key on Binance at any time, and our access ends the moment you do.',
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

            <div className="mt-10 lg:grid lg:grid-cols-[290px_minmax(0,1fr)] lg:gap-12">
              {/* Checklist — above the steps on mobile, sticky beside them on desktop */}
              <aside className="lg:sticky lg:top-6 lg:self-start">
                <Checklist done={done} toggle={(id) => toggle(id)} reset={reset} />
              </aside>

              {/* Steps */}
              <article>
                {GUIDE_STEPS.map((step, i) => {
                  const checked = done.includes(step.id)
                  return (
                    <section
                      key={step.id}
                      id={`step-${step.id}`}
                      data-aos="fade-up"
                      className="scroll-mt-8 border-t border-hair pt-10 mt-10 first:mt-10 lg:first:mt-0 lg:first:border-t-0 lg:first:pt-0"
                    >
                      <div className="flex items-start gap-4">
                        <TickBox
                          checked={checked}
                          number={i + 1}
                          onToggle={() => toggle(step.id)}
                          label={`Mark step ${i + 1} as done: ${step.title}`}
                        />
                        <div className="min-w-0">
                          <div className="font-mono text-[11px] uppercase tracking-widest text-faint">
                            Step {i + 1} of {GUIDE_STEPS.length}
                            {checked && <span className="ml-2 text-green">· Done</span>}
                          </div>
                          <h2 className="mt-1 font-display text-[26px] font-extrabold tracking-[-0.02em] leading-tight max-[560px]:text-[21px]">
                            {step.title}
                          </h2>
                        </div>
                      </div>

                      <div className="mt-5 max-w-[76ch]">
                        <p className="text-[15.5px] leading-[1.75] text-muted">
                          {withBold(step.summary)}
                        </p>

                        <ol className="mt-5 flex flex-col gap-3">
                          {step.actions.map((action, n) => (
                            <li key={action} className="flex gap-3.5">
                              <span className="mt-[1px] grid h-6 w-6 flex-none place-items-center rounded-full bg-accent-soft font-mono text-[11.5px] font-bold text-accent">
                                {n + 1}
                              </span>
                              <span className="text-[15px] leading-[1.7] text-text">
                                {withBold(action)}
                              </span>
                            </li>
                          ))}
                        </ol>

                        {step.ip && <IpBlock />}

                        {step.warning && (
                          <div className="my-5 flex gap-3.5 rounded-card border border-accent-line bg-accent-soft p-5 max-[560px]:p-4">
                            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-accent" />
                            <p className="text-[14.5px] leading-[1.7] text-text">
                              {withBold(step.warning)}
                            </p>
                          </div>
                        )}

                        {step.tip && (
                          <p className="my-5 flex gap-3 text-[14px] leading-[1.7] text-muted">
                            <Lightbulb size={16} className="mt-[3px] shrink-0 text-green" />
                            <span>{withBold(step.tip)}</span>
                          </p>
                        )}
                      </div>

                      {step.images && (
                        <div className="mt-6 flex flex-wrap items-start gap-4">
                          {step.images.map((src, n) => {
                            const alt = `Step ${i + 1}: ${step.title}${
                              step.images!.length > 1 ? ` (${n + 1})` : ''
                            }`
                            return (
                              <button
                                key={src}
                                type="button"
                                onClick={() => setZoom({ src, alt })}
                                className="group relative block max-w-[820px] cursor-zoom-in overflow-hidden rounded-card border border-border bg-surface2 transition-colors hover:border-accent"
                              >
                                <img
                                  src={src}
                                  alt={alt}
                                  loading="lazy"
                                  className="block h-auto max-h-[520px] w-auto max-w-full object-contain"
                                />
                                <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface/90 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-muted opacity-0 transition-opacity group-hover:opacity-100">
                                  <ZoomIn size={12} />
                                  Zoom
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )}

                      <div className="mt-6 flex flex-wrap items-center gap-3 max-[560px]:flex-col max-[560px]:items-stretch">
                        {step.link && <StepLink link={step.link} />}
                        {checked ? (
                          <button
                            type="button"
                            onClick={() => toggle(step.id, false)}
                            className="inline-flex items-center justify-center gap-2 rounded-pill border border-green px-5 py-3 text-[14px] font-bold text-green transition-colors hover:bg-surface2"
                          >
                            <Check size={15} strokeWidth={3} />
                            Done — tap to undo
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => completeAndNext(i)}
                            className={GHOST}
                          >
                            <Check size={15} />
                            {i === GUIDE_STEPS.length - 1 ? 'I’ve done this' : 'Done — next step'}
                          </button>
                        )}
                      </div>
                    </section>
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
                    <Link to="/trading-bot" className={GHOST}>
                      How the bot works
                    </Link>
                    <Link
                      to={allDone ? '/dashboard/exchanges' : '/dashboard/exchanges/connect'}
                      className={PRIMARY}
                    >
                      {allDone ? 'Go to my exchanges' : 'Connect Binance'}
                      <ChevronRight size={15} />
                    </Link>
                  </div>
                </div>
              </article>
            </div>

            {/* Troubleshooting */}
            <section
              data-aos="fade-up"
              className="mt-14 border-t border-hair pt-10"
            >
              <h2 className="font-display text-[26px] font-extrabold tracking-[-0.02em] leading-tight max-[560px]:text-[22px]">
                If something is not working
              </h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {[
                  {
                    q: 'I can’t tick “Enable Futures”',
                    a: 'Either the key has no IP restriction yet — add our server IP first, then tick it (step 6) — or the key was made before your Futures account was opened. In that case delete the key and create a new one (steps 4–7).',
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
                    a: `Check that your USDT is in the USDⓈ-M Futures wallet, not Spot (step 2), and that you have moved in at least ${MIN_DEPOSIT_USDT} USDT in total.`,
                  },
                  {
                    q: 'Binance deleted my key',
                    a: 'Binance removes keys that can trade without an IP restriction. Create a new one and lock it to our server IP before you tick Enable Futures (step 6).',
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
