import { Star } from 'lucide-react'

interface Quote {
  name: string
  handle: string
  body: string
  pnl?: string
}

const QUOTES: Quote[] = [
  {
    name: 'Marcus D.',
    handle: 'Binance · 8 months',
    body: 'Set it up in ten minutes and just… left it. Checked back a month later and my account was up double digits. The trade-only keys sold me — my coins never left Binance.',
    pnl: '+21.4%',
  },
  {
    name: 'Aisha R.',
    handle: 'Binance · 5 months',
    body: 'I used to blow up my account trying to time entries. Now the bot does the sizing and I sleep at night. Paying 20% of profit feels fair when there is actual profit.',
    pnl: '+14.8%',
  },
  {
    name: 'Tomas K.',
    handle: 'Binance · 1 year',
    body: 'The performance page is exactly what I wanted — real closed P&L, not vanity numbers. No subscription eating into a flat month is the part I respect most.',
    pnl: '+33.2%',
  },
  {
    name: 'Priya S.',
    handle: 'Binance · 3 months',
    body: 'Was skeptical about "automated trading" but the non-custodial setup is the real deal. I hold my own funds, they just execute. Alerts hit my dashboard instantly.',
    pnl: '+9.6%',
  },
  {
    name: 'Leon B.',
    handle: 'Binance · 7 months',
    body: 'Finally a bot product that does not ask for a monthly fee up front. They earn when I earn. That alignment is why I still have it running.',
    pnl: '+18.0%',
  },
  {
    name: 'Grace W.',
    handle: 'Binance · 4 months',
    body: 'Clean dashboard, transparent billing, and I can disconnect any time. Waiting on Bybit support next — will move more capital in when it lands.',
    pnl: '+12.3%',
  },
]

function Card({ q, index }: { q: Quote; index: number }) {
  return (
    <figure
      data-aos="fade-up"
      data-aos-delay={(index % 3) * 80}
      className="mb-4 break-inside-avoid rounded-card border border-border bg-surface p-6 transition-colors hover:border-accent-line"
    >
      <div className="flex items-center gap-0.5 text-accent">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} size={14} fill="currentColor" />
        ))}
        {q.pnl && (
          <span className="ml-auto font-mono text-[13px] font-semibold text-green">
            {q.pnl}
          </span>
        )}
      </div>
      <blockquote className="mt-4 text-[15px] leading-relaxed text-text/90">
        “{q.body}”
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft font-display text-sm font-bold text-accent">
          {q.name.charAt(0)}
        </div>
        <div>
          <div className="text-[14px] font-semibold">{q.name}</div>
          <div className="font-mono text-[11.5px] text-faint">{q.handle}</div>
        </div>
      </figcaption>
    </figure>
  )
}

export default function Testimonials() {
  return (
    <section className="relative py-16 md:py-24">
      <div className="max-w-[1200px] mx-auto px-6 max-[560px]:px-4">
        <div className="mb-12 text-center" data-aos="fade-up">
          <div className="inline-flex items-center gap-2 rounded-pill border border-accent-line bg-accent-soft px-3.5 py-1.5 text-[12.5px] font-medium text-accent">
            Trader stories
          </div>
          <h2 className="mt-5 font-display text-[clamp(2rem,4.2vw,3rem)] font-extrabold leading-[1.08] tracking-[-0.02em]">
            Real accounts, real P&amp;L.
          </h2>
        </div>

        <div className="[column-count:1] md:[column-count:2] lg:[column-count:3] [column-gap:1rem]">
          {QUOTES.map((q, i) => (
            <Card key={q.name} q={q} index={i} />
          ))}
        </div>

        <p className="mt-8 text-center font-mono text-[12px] text-faint">
          Illustrative results — automated trading carries risk and past
          performance does not guarantee future returns.
        </p>
      </div>
    </section>
  )
}
