import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '../../theme'

interface AuthFrameProps {
  /** Where the top-left link goes and what it says. */
  back?: { to: string; label: string }
  /** Card width. `wide` is the two-column sign-in card; `narrow` a single form. */
  width?: 'narrow' | 'wide'
  children: ReactNode
}

/**
 * The chrome every auth page shares: full-height centred stage, the
 * top-left back link, the theme toggle, the brand line, and the card. Pages
 * put their form inside; the sign-in page adds its own brand panel beside it.
 */
export default function AuthFrame({
  back = { to: '/', label: '← Home' },
  width = 'narrow',
  children,
}: AuthFrameProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg px-6 py-[72px] text-text transition-[background,color] duration-[400ms] max-[760px]:px-4">
      <Link
        to={back.to}
        className="absolute top-[22px] left-6 z-[5] flex cursor-pointer items-center gap-2 rounded-pill border border-border bg-surface py-[9px] pr-4 pl-3 font-mono text-[12px] text-text max-[760px]:left-4"
        title={back.label.replace(/^←\s*/, '')}
      >
        {back.label}
      </Link>
      <button
        type="button"
        className="absolute top-[22px] right-6 z-[5] flex items-center gap-2 font-mono text-[12px] bg-surface text-text border border-border py-[9px] px-3.5 rounded-pill cursor-pointer max-[760px]:right-4"
        title="Toggle theme"
        onClick={toggleTheme}
      >
        <span className="text-[14px]">{theme === 'dark' ? '☀' : '☾'}</span>
        {theme === 'dark' ? 'Light' : 'Dark'}
      </button>

      <div
        className={`w-full overflow-hidden rounded-[24px] border border-border bg-surface shadow-[0_40px_100px_rgba(0,0,0,0.35)] animate-[fadeup_0.6s_cubic-bezier(0.2,0.7,0.2,1)_both] ${
          width === 'wide'
            ? 'grid max-w-[960px] grid-cols-2 min-h-[600px] max-[760px]:grid-cols-1'
            : 'max-w-[460px] p-[44px] max-[560px]:p-7'
        }`}
      >
        {children}
      </div>
    </div>
  )
}

/** The logo + wordmark line at the top of every auth card. */
export function AuthBrand() {
  return (
    <div className="mb-[26px] flex items-center gap-2.5">
      <img className="h-[26px] w-[26px] scale-[1.6] object-contain" src="/assets/logo.png" alt="" />
      <span className="font-display text-[19px] font-extrabold">Pixel Alpha</span>
    </div>
  )
}
