import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, Compass, LifeBuoy } from 'lucide-react'
import Nav from '../components/landing/Nav'
import Footer from '../components/landing/Footer'
import { isLoggedIn } from '../lib/session'

/**
 * The `*` route. Before it existed an unknown URL rendered a blank screen —
 * no nav, no way back — which is what a mistyped link from an email or a
 * stale bookmark lands on.
 */
export default function NotFound() {
  const { pathname } = useLocation()
  const home = isLoggedIn() ? '/dashboard' : '/'

  useEffect(() => {
    document.title = 'Page not found — Pixel Alpha'
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text">
      <div className="flex-1 bg-[radial-gradient(circle_at_50%_-20%,var(--glow),transparent_55%)]">
        <Nav />
        <main className="mx-auto flex max-w-[720px] flex-col items-center px-10 pt-20 pb-28 text-center max-[560px]:px-5 max-[560px]:pt-14">
          <div className="inline-flex items-center gap-2 rounded-pill border border-accent-line bg-accent-soft px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-widest text-accent">
            <Compass size={13} />
            404
          </div>
          <h1 className="mt-6 font-display text-[46px] font-extrabold leading-[1.05] tracking-[-0.03em] max-[900px]:text-[34px]">
            That page isn't here.
          </h1>
          <p className="mt-4 max-w-[48ch] text-[15.5px] leading-[1.8] text-muted">
            Nothing lives at{' '}
            <code className="rounded-btn border border-border bg-surface px-1.5 py-0.5 font-mono text-[13px] text-text break-all">
              {pathname}
            </code>
            . The link may be old, or the address mistyped.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={home}
              className="inline-flex h-11 items-center gap-2 rounded-btn bg-accent px-5 text-[14px] font-bold text-on-accent transition-transform hover:-translate-y-px"
            >
              <ArrowLeft size={16} />
              {home === '/' ? 'Back to home' : 'Back to dashboard'}
            </Link>
            <Link
              to="/contact"
              className="inline-flex h-11 items-center gap-2 rounded-btn border border-border bg-surface px-5 text-[14px] font-bold text-text transition-colors hover:border-accent"
            >
              <LifeBuoy size={16} />
              Contact support
            </Link>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
