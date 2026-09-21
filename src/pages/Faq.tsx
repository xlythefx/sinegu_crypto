import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AOS from 'aos'
import 'aos/dist/aos.css'
import { ArrowUpRight, ChevronDown, HelpCircle } from 'lucide-react'
import Nav from '../components/landing/Nav'
import Footer from '../components/landing/Footer'
import ScrollToTop from '../components/ui/ScrollToTop'
import { useActiveSection } from '../hooks/useActiveSection'
import { FAQ, type FaqEntry } from '../lib/faq'

const WRAP = 'max-w-[1280px] mx-auto px-10 max-[560px]:px-5'

function Question({ entry, open, onToggle }: { entry: FaqEntry; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-t border-hair first:border-t-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-5 py-5 text-left"
      >
        <span className={`text-[15.5px] font-bold leading-snug transition-colors ${open ? 'text-accent' : 'text-text'}`}>
          {entry.q}
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-faint transition-transform duration-200 ${open ? 'rotate-180 text-accent' : ''}`}
        />
      </button>
      {open && (
        <p className="animate-[fadeup_0.25s_ease-out] max-w-[72ch] pb-6 text-[15px] leading-[1.8] text-muted">
          {entry.a}
        </p>
      )}
    </div>
  )
}

export default function Faq() {
  // One open answer per group; opening another closes it. Keyed by
  // `${group}:${index}` so groups stay independent.
  const [open, setOpen] = useState<string | null>(null)
  const active = useActiveSection(FAQ.map((g) => g.id))

  useEffect(() => {
    AOS.init({ duration: 700, once: true, offset: 80, easing: 'ease-out-cubic' })
    document.title = 'FAQ — Pixel Alpha'
    if (!window.location.hash) window.scrollTo(0, 0)
  }, [])

  const toc = (
    <ul className="flex flex-col gap-0.5">
      {FAQ.map((g) => {
        const isActive = g.id === active
        return (
          <li key={g.id}>
            <a
              href={`#${g.id}`}
              className={`flex rounded-btn px-3 py-2 text-[13.5px] leading-snug transition-colors ${
                isActive ? 'bg-accent-soft text-text' : 'text-muted hover:bg-surface hover:text-text'
              }`}
            >
              {g.title}
            </a>
          </li>
        )
      })}
    </ul>
  )

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="bg-[radial-gradient(circle_at_50%_-20%,var(--glow),transparent_55%)]">
        <Nav />

        <main className="relative">
          <header className={`${WRAP} pt-14 pb-10 max-[560px]:pt-10`} data-aos="fade-up">
            <div className="inline-flex items-center gap-2 rounded-pill border border-accent-line bg-accent-soft px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-widest text-accent">
              <HelpCircle size={13} />
              Help · Pixel Alpha
            </div>
            <h1 className="mt-5 font-display text-[46px] font-extrabold leading-[1.05] tracking-[-0.03em] max-[900px]:text-[34px]">
              Questions, answered straight.
            </h1>
            <p className="mt-5 max-w-[62ch] text-[15.5px] leading-[1.8] text-muted">
              How the bot trades, what it costs, what it can and cannot do with
              your account. If yours is not here,{' '}
              <Link to="/contact" className="text-accent hover:underline">
                ask a person
              </Link>
              .
            </p>
          </header>

          <div className={`${WRAP} grid gap-12 pb-24 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-16`}>
            <aside className="hidden lg:block">
              <nav aria-label="FAQ sections" className="sticky top-8 pr-2">
                <div className="mb-3 px-3 font-mono text-[11px] uppercase tracking-widest text-faint">
                  Topics
                </div>
                {toc}
              </nav>
            </aside>

            <div>
              <details className="mb-10 rounded-card border border-border bg-surface p-4 lg:hidden">
                <summary className="cursor-pointer select-none font-mono text-[12px] uppercase tracking-widest text-faint">
                  Jump to topic
                </summary>
                <div className="mt-3">{toc}</div>
              </details>

              {FAQ.map((group) => (
                <section
                  key={group.id}
                  id={group.id}
                  data-aos="fade-up"
                  className="scroll-mt-8 mt-10 first:mt-0"
                >
                  <h2 className="font-display text-[26px] font-extrabold tracking-[-0.02em] max-[560px]:text-[22px]">
                    {group.title}
                  </h2>
                  <div className="mt-4 rounded-card border border-border bg-surface px-6 max-[560px]:px-5">
                    {group.entries.map((entry, i) => {
                      const key = `${group.id}:${i}`
                      return (
                        <Question
                          key={key}
                          entry={entry}
                          open={open === key}
                          onToggle={() => setOpen(open === key ? null : key)}
                        />
                      )
                    })}
                  </div>
                </section>
              ))}

              <div
                data-aos="fade-up"
                className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-card border border-accent-line bg-accent-soft p-6 max-[560px]:p-5"
              >
                <div>
                  <div className="font-display text-[17px] font-bold">Still stuck?</div>
                  <p className="mt-1 text-[14.5px] text-muted">
                    A person who runs the platform answers — usually within the hour.
                  </p>
                </div>
                <Link
                  to="/contact"
                  className="inline-flex h-11 items-center gap-2 rounded-btn bg-accent px-5 text-[14px] font-bold text-on-accent transition-transform hover:-translate-y-px"
                >
                  Contact us
                  <ArrowUpRight size={16} />
                </Link>
              </div>
            </div>
          </div>

          <ScrollToTop />
        </main>
      </div>
      <Footer />
    </div>
  )
}
