import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react'
import { REGISTER_PATH } from '../../lib/routes'

/** Floating crypto chips — CSS `float` keyframe (defined in index.css). */
const COINS = [
  { sym: '₿', label: 'BTC', x: '-6%', y: '4%', size: 66, delay: 0, dur: 6 },
  { sym: 'Ξ', label: 'ETH', x: '86%', y: '14%', size: 54, delay: 0.6, dur: 7 },
  { sym: '◎', label: 'SOL', x: '78%', y: '72%', size: 48, delay: 1.2, dur: 6.5 },
]

const SPARK = 'M0 46 L26 40 L52 44 L78 30 L104 34 L130 20 L156 24 L182 8 L208 12'

export default function HeroV2() {
  const navigate = useNavigate()

  return (
    <section
      id="top"
      className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32"
    >
      {/* gold radial glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-[-10%] -z-0 h-[620px] w-[620px] -translate-x-1/2 rounded-full opacity-70"
        style={{
          background:
            'radial-gradient(circle, rgba(217,173,85,0.20) 0%, transparent 68%)',
          filter: 'blur(60px)',
        }}
      />
      {/* faint grid */}
      <div
        className="pointer-events-none absolute inset-0 -z-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(var(--hair) 1px, transparent 1px), linear-gradient(90deg, var(--hair) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
          maskImage:
            'radial-gradient(ellipse 80% 60% at 50% 30%, #000 40%, transparent 100%)',
        }}
      />

      <div className="relative z-10 max-w-[1200px] mx-auto px-6 max-[560px]:px-4 grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
        {/* ---------- Left ---------- */}
        <div>
          <div
            data-aos="fade-up"
            className="inline-flex items-center gap-2 rounded-pill border border-accent-line bg-accent-soft px-3.5 py-1.5 text-[12.5px] font-medium text-accent"
          >
            <Sparkles size={14} />
            Automated crypto trading — hands-off
          </div>

          <h1
            data-aos="fade-up"
            data-aos-delay="60"
            className="mt-6 font-display font-extrabold leading-[1.04] tracking-[-0.02em] text-[clamp(2.5rem,6vw,4.25rem)]"
          >
            Your capital, traded by{' '}
            <span className="relative whitespace-nowrap">
              <span className="bg-gradient-to-r from-accent via-[#f0d089] to-accent bg-clip-text text-transparent">
                proven strategies
              </span>
            </span>
            .
          </h1>

          <p
            data-aos="fade-up"
            data-aos-delay="120"
            className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted"
          >
            Connect Binance, Bybit or MEXC with{' '}
            <span className="text-text font-medium">trade-only API keys</span> and
            let our bots run 24/7. Your funds never leave your exchange — and you
            only pay <span className="text-text font-medium">20% of profit</span>.
          </p>

          <div
            data-aos="fade-up"
            data-aos-delay="180"
            className="mt-8 flex flex-wrap items-center gap-3.5"
          >
            <button
              onClick={() => navigate(REGISTER_PATH)}
              className="group inline-flex items-center gap-2 rounded-pill bg-accent px-6 py-3.5 text-[15px] font-bold text-on-accent shadow-[0_12px_30px_-10px_var(--glow)] transition-transform hover:-translate-y-0.5"
            >
              Register
              <ArrowUpRight
                size={18}
                className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </button>
            <a
              href="#performance"
              className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface/50 px-6 py-3.5 text-[15px] font-semibold text-text transition-colors hover:border-accent-line"
            >
              <TrendingUp size={18} className="text-accent" />
              See performance
            </a>
          </div>

          <div
            data-aos="fade-up"
            data-aos-delay="240"
            className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px] text-faint"
          >
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-green" />
              Non-custodial · trade-only keys
            </span>
            <span className="hidden sm:inline text-border">|</span>
            <span className="font-mono">Binance · Bybit · MEXC</span>
          </div>
        </div>

        {/* ---------- Right: glass live-P&L card ---------- */}
        <div
          data-aos="fade-left"
          data-aos-delay="120"
          className="relative mx-auto w-full max-w-[440px]"
        >
          {/* floating coin chips */}
          {COINS.map((c) => (
            <div
              key={c.label}
              className="absolute z-20 flex items-center justify-center rounded-2xl border border-accent-line bg-surface/80 backdrop-blur-md shadow-[0_16px_40px_-16px_rgba(0,0,0,0.7)]"
              style={{
                left: c.x,
                top: c.y,
                width: c.size,
                height: c.size,
                animation: `float ${c.dur}s ease-in-out ${c.delay}s infinite`,
              }}
            >
              <span className="text-2xl text-accent">{c.sym}</span>
            </div>
          ))}

          <div className="relative z-10 rounded-[22px] border border-border bg-gradient-to-b from-surface to-surface2 p-6 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[12px] uppercase tracking-widest text-faint font-mono">
                  Live portfolio
                </div>
                <div className="mt-1 text-[13px] text-muted">Binance · Futures</div>
              </div>
              <span className="inline-flex items-center gap-2 rounded-pill bg-[var(--accentSoft)] px-3 py-1.5 text-[11.5px] font-semibold text-green">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green" />
                </span>
                Live
              </span>
            </div>

            <div className="mt-5">
              <div className="font-display text-4xl font-extrabold tracking-tight">
                +$12,480.34
              </div>
              <div className="mt-1 text-[13.5px] font-medium text-green">
                +18.6% · last 30 days
              </div>
            </div>

            {/* sparkline */}
            <div className="mt-5 rounded-2xl border border-hair bg-surface2/60 p-4">
              <svg viewBox="0 0 208 54" className="w-full h-[64px]" fill="none">
                <defs>
                  <linearGradient id="hv2spark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={`${SPARK} L208 54 L0 54 Z`}
                  fill="url(#hv2spark)"
                />
                <path
                  d={SPARK}
                  stroke="var(--accent)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* position rows */}
            <div className="mt-4 space-y-2.5">
              {[
                { pair: 'BTC/USDT', side: 'LONG', pnl: '+4.2%' },
                { pair: 'ETH/USDT', side: 'LONG', pnl: '+2.8%' },
                { pair: 'SOL/USDT', side: 'SHORT', pnl: '+6.1%' },
              ].map((p) => (
                <div
                  key={p.pair}
                  className="flex items-center justify-between rounded-xl border border-hair bg-surface/50 px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[13px] text-text">{p.pair}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        p.side === 'LONG'
                          ? 'bg-[var(--accentSoft)] text-green'
                          : 'bg-[#2a1414] text-red'
                      }`}
                    >
                      {p.side}
                    </span>
                  </div>
                  <span className="font-mono text-[13px] font-semibold text-green">
                    {p.pnl}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
