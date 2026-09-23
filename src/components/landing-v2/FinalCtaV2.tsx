import { useNavigate } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { REGISTER_PATH } from '../../lib/routes'

export default function FinalCtaV2() {
  const navigate = useNavigate()

  return (
    <section className="relative py-16 md:py-24">
      <div className="max-w-[1100px] mx-auto px-6 max-[560px]:px-4">
        <div
          data-aos="fade-up"
          className="relative overflow-hidden rounded-[26px] border border-accent-line px-8 py-16 md:py-20 text-center"
          style={{
            background:
              'radial-gradient(120% 140% at 50% 0%, rgba(217,173,85,0.24) 0%, var(--surface) 46%, var(--surface2) 100%)',
          }}
        >
          <div
            className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full opacity-50 blur-3xl"
            style={{ background: 'rgba(217,173,85,0.22)' }}
          />
          <div className="relative z-10">
            <div className="mx-auto flex w-fit items-center gap-2 rounded-pill border border-accent-line bg-bg/40 backdrop-blur-sm px-4 py-1.5 text-[12.5px] font-medium text-accent">
              <span className="flex -space-x-2">
                {['#d9ad55', '#f0b90b', '#2fd67a'].map((c) => (
                  <span
                    key={c}
                    className="h-5 w-5 rounded-full border-2 border-bg"
                    style={{ background: c }}
                  />
                ))}
              </span>
              Join thousands of hands-off traders
            </div>

            <h2 className="mx-auto mt-6 max-w-2xl font-display text-[clamp(2.2rem,5vw,3.5rem)] font-extrabold leading-[1.06] tracking-[-0.02em]">
              Put your capital to work today.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[16.5px] text-muted">
              Connect an exchange in minutes. Keep full custody. Pay only when you
              profit.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3.5">
              <button
                onClick={() => navigate(REGISTER_PATH)}
                className="group inline-flex items-center gap-2 rounded-pill bg-accent px-8 py-4 text-[16px] font-bold text-on-accent shadow-[0_16px_40px_-12px_var(--glow)] transition-transform hover:-translate-y-0.5"
              >
                Register
                <ArrowUpRight
                  size={19}
                  className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </button>
              <a
                href="#performance"
                className="inline-flex items-center rounded-pill border border-border bg-surface/50 px-8 py-4 text-[16px] font-semibold text-text transition-colors hover:border-accent-line"
              >
                See performance
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
