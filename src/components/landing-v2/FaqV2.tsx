import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const FAQS = [
  {
    q: 'Is my money safe? Can you withdraw it?',
    a: 'No. You connect with trade-only API keys, which let the bot open and close positions but never withdraw. Your funds stay in your own exchange account at all times — SineguAlerts is fully non-custodial.',
  },
  {
    q: 'How does the 20% fee actually work?',
    a: 'We charge 20% of realized profit, measured against a high-water mark. If your account is flat or down for a period, you pay nothing. You’re only ever billed on new profit above your previous peak.',
  },
  {
    q: 'Which exchanges are supported?',
    a: 'Binance is live today. Bybit and MEXC support is coming soon — once their integrations land, you’ll be able to connect those accounts the same way, with no changes on your end.',
  },
  {
    q: 'Do I need trading experience?',
    a: 'No. The strategies handle entries, exits and position sizing automatically. You connect an exchange once and monitor performance from your dashboard — there are no charts to watch or orders to place.',
  },
  {
    q: 'Can I stop or disconnect any time?',
    a: 'Yes. You can pause the bot or revoke the API keys from your exchange whenever you like. There’s no subscription and no lock-in.',
  },
]

function Item({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(index === 0)
  return (
    <div
      data-aos="fade-up"
      data-aos-delay={index * 60}
      className={`rounded-card border bg-surface transition-colors ${
        open ? 'border-accent-line' : 'border-border hover:border-hair'
      }`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left"
        aria-expanded={open}
      >
        <span className="text-[15.5px] font-semibold">{q}</span>
        <ChevronDown
          size={20}
          className={`shrink-0 text-muted transition-transform duration-300 ${
            open ? 'rotate-180 text-accent' : ''
          }`}
        />
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-[14.5px] leading-relaxed text-muted">{a}</p>
        </div>
      </div>
    </div>
  )
}

export default function FaqV2() {
  return (
    <section id="faq" className="relative py-16 md:py-24">
      <div className="max-w-[820px] mx-auto px-6 max-[560px]:px-4">
        <div className="mb-12 text-center" data-aos="fade-up">
          <div className="inline-flex items-center gap-2 rounded-pill border border-accent-line bg-accent-soft px-3.5 py-1.5 text-[12.5px] font-medium text-accent">
            FAQ
          </div>
          <h2 className="mt-5 font-display text-[clamp(2rem,4.2vw,3rem)] font-extrabold leading-[1.08] tracking-[-0.02em]">
            Questions, answered.
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((f, i) => (
            <Item key={f.q} q={f.q} a={f.a} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
