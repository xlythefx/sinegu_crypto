import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTheme } from '../../theme'
import { useSessionUser } from '../../hooks/useSessionUser'
import UserAvatar from '../ui/UserAvatar'

const LINKS = [
  { label: 'Performance', href: '#performance' },
  { label: 'Features', href: '#features' },
  { label: 'Exchanges', href: '#exchanges' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
]

export default function NavV2() {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const user = useSessionUser()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="sticky top-0 z-50">
      <div
        className={`transition-[background,border-color,backdrop-filter] duration-300 border-b ${
          scrolled
            ? 'bg-bg/70 backdrop-blur-xl border-hair'
            : 'bg-transparent border-transparent'
        }`}
      >
        <nav className="max-w-[1200px] mx-auto px-6 max-[560px]:px-4 h-[68px] flex items-center justify-between gap-8">
          <div className="flex items-center gap-10">
            <a href="#top" className="flex items-center gap-2.5">
              <img
                className="w-6 h-6 object-contain scale-[1.6]"
                src="/assets/logo.png"
                alt=""
              />
              <span className="font-display font-extrabold text-lg tracking-tight">
                Pixel Alpha
              </span>
            </a>
            <div className="hidden lg:flex gap-7 text-[13.5px] font-medium text-muted">
              {LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="hover:text-text transition-colors"
                >
                  {l.label}
                </a>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              className="hidden sm:flex items-center gap-2 font-mono text-xs bg-surface/60 text-text border border-border py-[9px] px-3.5 rounded-pill cursor-pointer hover:border-accent-line transition-colors"
              title="Toggle theme"
              onClick={toggleTheme}
            >
              <span className="text-sm">{theme === 'dark' ? '☀' : '☾'}</span>
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            {user ? (
              <Link
                to="/dashboard"
                className="inline-flex rounded-full transition-transform duration-150 hover:-translate-y-px"
                title={`${user.name} — go to dashboard`}
              >
                <UserAvatar user={user} size={38} />
              </Link>
            ) : (
              <>
                <Link
                  to="/auth"
                  className="hidden sm:inline text-sm font-semibold text-muted hover:text-text transition-colors"
                >
                  Sign in
                </Link>
                <button
                  className="font-body text-sm bg-accent text-on-accent py-[10px] px-5 rounded-pill font-bold cursor-pointer shadow-[0_8px_24px_-8px_var(--glow)] hover:-translate-y-px transition-transform"
                  onClick={() => navigate('/auth')}
                >
                  Start free
                </button>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}
