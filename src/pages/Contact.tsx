import { useEffect, useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import AOS from 'aos'
import 'aos/dist/aos.css'
import {
  ArrowUpRight,
  BookOpen,
  Building2,
  Check,
  Clock,
  Copy,
  DollarSign,
  HelpCircle,
  LifeBuoy,
  Mail,
  Send,
  ShieldAlert,
} from 'lucide-react'
import Nav from '../components/landing/Nav'
import Footer from '../components/landing/Footer'
import ScrollToTop from '../components/ui/ScrollToTop'
import {
  COMPANY,
  OFFICE,
  SUPPORT_EMAIL,
  SUPPORT_TELEGRAM_HANDLE,
  SUPPORT_TELEGRAM_URL,
} from '../lib/company'

const WRAP = 'max-w-[1280px] mx-auto px-10 max-[560px]:px-5'

type Icon = ComponentType<{ size?: number; className?: string }>

interface Channel {
  icon: Icon
  eyebrow: string
  title: string
  body: string
  /** What the big button prints. */
  value: string
  href: string
  cta: string
  /** Copyable text (the raw address / handle) — omitted when a copy makes no sense. */
  copy?: string
  featured?: boolean
}

/**
 * The two ways to reach a person: the official support desk on Telegram and
 * by email (`lib/company.ts` — the same addresses the legal pages and
 * invoices print). No personal line beside them — a contact is a desk, and it
 * must outlive whoever holds it today.
 */
const CHANNELS: Channel[] = [
  {
    icon: Send,
    eyebrow: 'Fastest',
    title: 'Telegram support',
    body: 'Setup, API keys, a trade you want explained. Usually answered within the hour during the trading day.',
    value: SUPPORT_TELEGRAM_HANDLE,
    href: SUPPORT_TELEGRAM_URL,
    cta: 'Open in Telegram',
    copy: SUPPORT_TELEGRAM_HANDLE,
    featured: true,
  },
  {
    icon: Mail,
    eyebrow: 'Billing & account',
    title: 'Email support',
    body: 'Invoices, payments, account changes and data requests. Write from the email on your account — we answer within one business day.',
    value: SUPPORT_EMAIL,
    href: `mailto:${SUPPORT_EMAIL}`,
    cta: 'Send an email',
    copy: SUPPORT_EMAIL,
  },
]

/** Answers people write in for that a page already gives. */
const SELF_SERVE: { icon: Icon; label: string; hint: string; to: string }[] = [
  { icon: BookOpen, label: 'Binance setup guide', hint: 'Creating a trade-only API key, step by step', to: '/docs/binance' },
  { icon: HelpCircle, label: 'FAQ', hint: 'Fees, custody, minimums, what happens when', to: '/faq' },
  { icon: DollarSign, label: 'Billing & invoices', hint: 'Your invoices and how the 20% is computed', to: '/dashboard/invoices' },
  { icon: ShieldAlert, label: 'Risk disclosure', hint: 'What can go wrong, in plain language', to: '/risk' },
]

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      setTimeout(() => setDone(false), 1600)
    } catch {
      // Clipboard is permission-gated in some browsers; the address is
      // printed beside the button, so failing silently loses nothing.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={`Copy ${text}`}
      aria-label={`Copy ${text}`}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-btn border border-border bg-surface text-muted transition-colors hover:border-accent hover:text-accent"
    >
      {done ? <Check size={16} className="text-accent" /> : <Copy size={16} />}
    </button>
  )
}

function ChannelCard({ channel, delay }: { channel: Channel; delay: number }) {
  const { icon: Icon } = channel
  const frame = channel.featured
    ? 'border-accent-line bg-accent-soft'
    : 'border-border bg-surface'

  return (
    <div
      data-aos="fade-up"
      data-aos-delay={delay}
      className={`flex flex-col rounded-card border p-7 max-[560px]:p-5 ${frame}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-btn border border-accent-line bg-surface text-accent">
          <Icon size={20} />
        </span>
        <span className="rounded-pill border border-border bg-surface px-3 py-1 font-mono text-[10.5px] uppercase tracking-widest text-faint">
          {channel.eyebrow}
        </span>
      </div>
      <h2 className="mt-5 font-display text-[22px] font-extrabold tracking-[-0.02em]">
        {channel.title}
      </h2>
      <p className="mt-2 flex-1 text-[14.5px] leading-[1.7] text-muted">
        {channel.body}
      </p>
      <div className="mt-6 font-mono text-[14px] font-semibold text-text break-all">
        {channel.value}
      </div>
      <div className="mt-3 flex items-center gap-2.5">
        <a
          href={channel.href}
          target={channel.href.startsWith('mailto:') ? undefined : '_blank'}
          rel={channel.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-btn bg-accent px-5 text-[14px] font-bold text-on-accent transition-transform hover:-translate-y-px"
        >
          {channel.cta}
          <ArrowUpRight size={16} />
        </a>
        {channel.copy && <CopyButton text={channel.copy} />}
      </div>
    </div>
  )
}

export default function Contact() {
  useEffect(() => {
    AOS.init({ duration: 700, once: true, offset: 80, easing: 'ease-out-cubic' })
    document.title = 'Contact — Pixel Alpha'
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="bg-[radial-gradient(circle_at_50%_-20%,var(--glow),transparent_55%)]">
        <Nav />

        <main className="relative">
          <header className={`${WRAP} pt-14 pb-10 max-[560px]:pt-10`} data-aos="fade-up">
            <div className="inline-flex items-center gap-2 rounded-pill border border-accent-line bg-accent-soft px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-widest text-accent">
              <LifeBuoy size={13} />
              Support · Pixel Alpha
            </div>
            <h1 className="mt-5 font-display text-[46px] font-extrabold leading-[1.05] tracking-[-0.03em] max-[900px]:text-[34px]">
              Talk to a person.
            </h1>
            <p className="mt-5 max-w-[62ch] text-[15.5px] leading-[1.8] text-muted">
              No ticket queue, no bot. Pick the channel that fits and a human
              who runs the platform answers. Include the email on your account
              if it is about billing or a trade — it saves a round trip.
            </p>
          </header>

          <section className={`${WRAP} pb-14`}>
            <div className="grid gap-5 md:grid-cols-2">
              {CHANNELS.map((c, i) => (
                <ChannelCard key={c.title} channel={c} delay={i * 80} />
              ))}
            </div>
          </section>

          <section className={`${WRAP} grid gap-5 pb-24 lg:grid-cols-[1fr_1.4fr]`}>
            {/* The product's office, not the billing entity — that one stays
                on invoices and legal text, where the entity that bills must
                be named. Here a visitor is looking for Pixel Alpha. */}
            <div
              data-aos="fade-up"
              className="rounded-card border border-border bg-surface p-7 max-[560px]:p-5"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-btn border border-border bg-surface2 text-accent">
                  <Building2 size={18} />
                </span>
                <div className="font-mono text-[11px] uppercase tracking-widest text-faint">
                  {OFFICE.label}
                </div>
              </div>
              <div className="mt-5 font-display text-[19px] font-extrabold">
                {OFFICE.name}
              </div>
              <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-[14px]">
                <dt className="font-mono text-[11px] uppercase tracking-widest text-faint pt-0.5">Address</dt>
                <dd className="text-text">
                  {OFFICE.addressLines.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </dd>
                <dt className="font-mono text-[11px] uppercase tracking-widest text-faint pt-0.5">Hours</dt>
                <dd className="flex items-start gap-2 text-text">
                  <Clock size={14} className="mt-[3px] shrink-0 text-faint" />
                  <span>{OFFICE.hours}</span>
                </dd>
                <dt className="font-mono text-[11px] uppercase tracking-widest text-faint pt-0.5">Web</dt>
                <dd className="text-text">{COMPANY.website}</dd>
              </dl>
              <p className="mt-6 text-[13px] leading-[1.7] text-faint">
                Legal notices and data requests under our{' '}
                <Link to="/privacy" className="text-muted underline-offset-2 hover:text-text hover:underline">
                  Privacy Policy
                </Link>{' '}
                go to {SUPPORT_EMAIL}.
              </p>
            </div>

            <div
              data-aos="fade-up"
              data-aos-delay="80"
              className="rounded-card border border-border bg-surface p-7 max-[560px]:p-5"
            >
              <div className="font-mono text-[11px] uppercase tracking-widest text-faint">
                Before you write
              </div>
              <p className="mt-2 text-[14.5px] leading-[1.7] text-muted">
                Most questions we get are answered on one of these pages.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {SELF_SERVE.map(({ icon: Icon, label, hint, to }) => (
                  <Link
                    key={to}
                    to={to}
                    className="group flex items-start gap-3.5 rounded-btn border border-border bg-surface2 p-4 transition-colors hover:border-accent"
                  >
                    <span className="mt-0.5 shrink-0 text-accent">
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-[14.5px] font-bold text-text">
                        {label}
                        <ArrowUpRight
                          size={14}
                          className="text-faint transition-colors group-hover:text-accent"
                        />
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-[1.6] text-muted">
                        {hint}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <ScrollToTop />
        </main>
      </div>
      <Footer />
    </div>
  )
}
