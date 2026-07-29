import {
  Bot,
  KeyRound,
  Gauge,
  BellRing,
  Wallet,
  ArrowUpRight,
} from 'lucide-react'

function SectionHead() {
  return (
    <div className="mb-12 text-center" data-aos="fade-up">
      <div className="inline-flex items-center gap-2 rounded-pill border border-accent-line bg-accent-soft px-3.5 py-1.5 text-[12.5px] font-medium text-accent">
        Why SineguAlerts
      </div>
      <h2 className="mt-5 font-display text-[clamp(2rem,4.2vw,3rem)] font-extrabold leading-[1.08] tracking-[-0.02em]">
        Everything runs itself.
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-[16px] text-muted">
        Strategies execute around the clock while you keep full custody. No charts
        to watch, no manual orders.
      </p>
    </div>
  )
}

export default function FeatureBento() {
  return (
    <section id="features" className="relative py-16 md:py-24">
      <div className="max-w-[1200px] mx-auto px-6 max-[560px]:px-4">
        <SectionHead />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[236px]">
          {/* Hero card — large */}
          <div
            data-aos="fade-up"
            className="md:col-span-2 md:row-span-2 group relative overflow-hidden rounded-[22px] border border-accent-line p-9 flex flex-col justify-end"
            style={{
              background:
                'radial-gradient(120% 120% at 15% 0%, rgba(217,173,85,0.22) 0%, var(--surface) 45%, var(--surface2) 100%)',
            }}
          >
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-60 blur-3xl"
              style={{ background: 'rgba(217,173,85,0.18)' }}
            />
            <div className="relative z-10 space-y-4">
              <span className="inline-flex items-center gap-2 rounded-pill bg-bg/40 backdrop-blur-sm px-3.5 py-1.5 text-[12.5px] font-medium text-accent border border-accent-line">
                <Bot size={15} />
                Bots running 24/7
              </span>
              <h3 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight">
                Proven strategies,
                <br />
                zero babysitting
              </h3>
              <p className="max-w-md text-[15.5px] text-muted">
                Position sizing, entries and exits are fully automated across every
                connected exchange — you just watch the P&amp;L roll in.
              </p>
            </div>
          </div>

          {/* Trade-only keys */}
          <div className="group rounded-[22px] border border-border bg-surface p-7 flex flex-col justify-between transition-colors hover:border-accent-line">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <KeyRound size={22} />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-lg font-bold">Trade-only keys</h4>
              <p className="text-[14px] text-muted">
                Keys can trade but never withdraw. Funds stay on your exchange.
              </p>
            </div>
          </div>

          {/* Auto sizing */}
          <div className="group rounded-[22px] border border-border bg-surface p-7 flex flex-col justify-between transition-colors hover:border-accent-line">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <Gauge size={22} />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-lg font-bold">Smart sizing</h4>
              <p className="text-[14px] text-muted">
                Risk-adjusted position sizing on every trade, automatically.
              </p>
            </div>
          </div>

          {/* Pay-on-profit CTA card */}
          <a
            href="#pricing"
            className="group relative overflow-hidden rounded-[22px] border border-border bg-gradient-to-br from-[#12100a] to-surface2 p-7 text-text flex flex-col justify-between cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <span className="rounded-pill bg-accent-soft px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-accent">
                Only 20%
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface border border-border transition-all group-hover:bg-accent group-hover:text-on-accent group-hover:rotate-45">
                <ArrowUpRight size={18} />
              </span>
            </div>
            <h4 className="font-display text-2xl font-bold leading-tight">
              You only pay
              <br />
              when you profit
            </h4>
          </a>

          {/* Real-time alerts */}
          <div className="group rounded-[22px] border border-border bg-surface p-7 flex flex-col justify-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <BellRing size={22} />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-lg font-bold">Real-time alerts</h4>
              <p className="text-[14px] text-muted">
                Every fill, every close — pushed to your dashboard instantly.
              </p>
            </div>
          </div>

          {/* Non-custodial highlight */}
          <div
            className="group relative overflow-hidden rounded-[22px] border border-accent-line p-7 text-text flex flex-col justify-center gap-2"
            style={{
              background:
                'linear-gradient(135deg, rgba(217,173,85,0.16) 0%, var(--surface2) 70%)',
            }}
          >
            <div
              className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full opacity-50 blur-3xl"
              style={{ background: 'rgba(217,173,85,0.15)' }}
            />
            <div className="relative z-10 flex items-center gap-2 text-accent">
              <Wallet size={18} />
              <span className="text-[12px] font-semibold uppercase tracking-widest">
                Non-custodial
              </span>
            </div>
            <p className="relative z-10 font-display text-2xl font-extrabold">
              We never hold your money.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
