import { Check, Lock } from 'lucide-react'
import { EXCHANGE_META, EXCHANGE_ORDER } from '../exchanges/meta'

export default function ExchangesV2() {
  return (
    <section id="exchanges" className="relative py-16 md:py-24">
      <div className="max-w-[1200px] mx-auto px-6 max-[560px]:px-4">
        <div className="mb-12 text-center" data-aos="fade-up">
          <div className="inline-flex items-center gap-2 rounded-pill border border-accent-line bg-accent-soft px-3.5 py-1.5 text-[12.5px] font-medium text-accent">
            Supported exchanges
          </div>
          <h2 className="mt-5 font-display text-[clamp(2rem,4.2vw,3rem)] font-extrabold leading-[1.08] tracking-[-0.02em]">
            Connect where you already trade.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[16px] text-muted">
            Link an account with trade-only API keys. Binance is live today — Bybit
            and MEXC are landing soon.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {EXCHANGE_ORDER.map((kind, i) => {
            const ex = EXCHANGE_META[kind]
            return (
              <div
                key={kind}
                data-aos="fade-up"
                data-aos-delay={i * 80}
                className={`relative overflow-hidden rounded-card border p-7 transition-colors ${
                  ex.available
                    ? 'border-accent-line bg-surface'
                    : 'border-border bg-surface2'
                }`}
              >
                <div
                  className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-40 blur-3xl"
                  style={{ background: ex.color }}
                />
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-2xl font-display text-lg font-extrabold text-bg"
                      style={{ background: ex.color }}
                    >
                      {ex.label.charAt(0)}
                    </span>
                    <span className="font-display text-xl font-bold">
                      {ex.label}
                    </span>
                  </div>
                  {ex.available ? (
                    <span className="inline-flex items-center gap-1.5 rounded-pill bg-[var(--accentSoft)] px-3 py-1.5 text-[11.5px] font-semibold text-green">
                      <Check size={13} /> Live
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-faint border border-border">
                      <Lock size={12} /> Coming soon
                    </span>
                  )}
                </div>
                <p className="relative z-10 mt-5 text-[14.5px] text-muted">
                  {ex.blurb}.
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
