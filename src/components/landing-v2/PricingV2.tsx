import { useNavigate } from 'react-router-dom'
import { Check, ArrowRight } from 'lucide-react'

const INCLUDED = [
  'All automated strategies',
  'Binance, Bybit & MEXC (as they launch)',
  'Trade-only, non-custodial keys',
  'Real-time dashboard & alerts',
  'Full closed-P&L history',
  'Disconnect any time',
]

const POINTS = [
  { k: 'No subscription', v: 'Nothing to pay up front — ever.' },
  { k: 'No profit, no fee', v: 'Down month? You pay $0.' },
  { k: 'High-water mark', v: 'You’re only billed on new profit.' },
]

export default function PricingV2() {
  const navigate = useNavigate()

  return (
    <section id="pricing" className="relative py-16 md:py-24">
      <div className="max-w-[1200px] mx-auto px-6 max-[560px]:px-4">
        <div className="mb-12 text-center" data-aos="fade-up">
          <div className="inline-flex items-center gap-2 rounded-pill border border-accent-line bg-accent-soft px-3.5 py-1.5 text-[12.5px] font-medium text-accent">
            Pricing
          </div>
          <h2 className="mt-5 font-display text-[clamp(2rem,4.2vw,3rem)] font-extrabold leading-[1.08] tracking-[-0.02em]">
            One number. Only when you win.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[16px] text-muted">
            No tiers, no monthly bill. We take a share of profit — and nothing else.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-4 items-stretch">
          {/* Highlight card */}
          <div
            data-aos="fade-up"
            className="relative overflow-hidden rounded-[22px] border border-accent-line p-9 md:p-10"
            style={{
              background:
                'radial-gradient(130% 130% at 20% 0%, rgba(217,173,85,0.20) 0%, var(--surface) 48%, var(--surface2) 100%)',
            }}
          >
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-50 blur-3xl"
              style={{ background: 'rgba(217,173,85,0.20)' }}
            />
            <div className="relative z-10">
              <span className="rounded-pill bg-accent-soft px-3.5 py-1.5 text-[11.5px] font-bold uppercase tracking-wider text-accent border border-accent-line">
                Performance fee
              </span>
              <div className="mt-6 flex items-end gap-2">
                <span className="font-display text-7xl font-extrabold leading-none tracking-tight text-accent">
                  20%
                </span>
                <span className="mb-2 text-[16px] text-muted">of profit only</span>
              </div>
              <p className="mt-4 max-w-md text-[15.5px] text-muted">
                Billed against a high-water mark, so you’re never charged twice on
                the same gains. Connect, and start free.
              </p>

              <button
                onClick={() => navigate('/auth')}
                className="group mt-8 inline-flex items-center gap-2 rounded-pill bg-accent px-7 py-3.5 text-[15px] font-bold text-on-accent shadow-[0_12px_30px_-10px_var(--glow)] transition-transform hover:-translate-y-0.5"
              >
                Start free
                <ArrowRight
                  size={18}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </button>

              <div className="mt-9 grid gap-3 sm:grid-cols-2">
                {INCLUDED.map((f) => (
                  <div key={f} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent-soft text-green">
                      <Check size={12} />
                    </span>
                    <span className="text-[14px] text-text/90">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Supporting points */}
          <div className="flex flex-col gap-4" data-aos="fade-up" data-aos-delay="80">
            {POINTS.map((p) => (
              <div
                key={p.k}
                className="flex-1 rounded-card border border-border bg-surface p-6 flex flex-col justify-center"
              >
                <div className="font-display text-xl font-bold">{p.k}</div>
                <p className="mt-1.5 text-[14.5px] text-muted">{p.v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
