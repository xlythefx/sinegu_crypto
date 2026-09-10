import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'

// `to` = an in-app route (rendered as a <Link>); `href` = an on-page anchor.
const COLUMNS: {
  title: string
  links: { label: string; href?: string; to?: string }[]
}[] = [
  {
    title: 'Product',
    links: [
      { label: 'Performance', href: '#performance' },
      { label: 'Features', href: '#features' },
      { label: 'Exchanges', href: '#exchanges' },
      { label: 'Pricing', href: '#pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'FAQ', href: '#faq' },
      { label: 'Contact', href: '#' },
      { label: 'Terms', to: '/terms' },
      { label: 'Privacy', href: '#' },
    ],
  },
]

export default function FooterV2() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  const subscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setSent(true)
    setEmail('')
    setTimeout(() => setSent(false), 3000)
  }

  return (
    <footer className="relative border-t border-hair bg-surface2/60">
      <div className="max-w-[1200px] mx-auto px-6 max-[560px]:px-4 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1.4fr]">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5">
              <img
                className="w-6 h-6 object-contain scale-[1.6]"
                src="/assets/logo.png"
                alt=""
              />
              <span className="font-display font-extrabold text-lg">
                Pixel Alpha
              </span>
            </div>
            <p className="mt-4 max-w-xs text-[14px] text-muted">
              Automated crypto trading with full custody. Connect Binance, Bybit or
              MEXC and pay only when you profit.
            </p>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <div className="font-mono text-[12px] uppercase tracking-widest text-faint">
                {col.title}
              </div>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.to ? (
                      <Link
                        to={l.to}
                        className="text-[14px] text-muted hover:text-text transition-colors"
                      >
                        {l.label}
                      </Link>
                    ) : (
                      <a
                        href={l.href}
                        className="text-[14px] text-muted hover:text-text transition-colors"
                      >
                        {l.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Newsletter */}
          <div>
            <div className="font-mono text-[12px] uppercase tracking-widest text-faint">
              Stay updated
            </div>
            <p className="mt-4 text-[14px] text-muted">
              Get notified when Bybit &amp; MEXC support goes live.
            </p>
            <form onSubmit={subscribe} className="mt-4 flex items-center gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@email.com"
                className="min-w-0 flex-1 rounded-field border border-border bg-surface px-3.5 py-2.5 text-[14px] text-text placeholder:text-faint outline-none focus:border-accent-line"
              />
              <button
                type="submit"
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-field bg-accent text-on-accent transition-transform hover:-translate-y-px"
                aria-label="Subscribe"
              >
                {sent ? <Check size={18} /> : <ArrowRight size={18} />}
              </button>
            </form>
            {sent && (
              <p className="mt-2 text-[12.5px] text-green">You’re on the list.</p>
            )}
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-hair pt-8 sm:flex-row">
          <p className="text-[13px] text-faint">
            © {new Date().getFullYear()} Pixel Alpha. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-[13px] text-muted">
            <Link to="/auth" className="hover:text-text transition-colors">
              Sign in
            </Link>
            <span className="font-mono text-faint">Binance · Bybit · MEXC</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
