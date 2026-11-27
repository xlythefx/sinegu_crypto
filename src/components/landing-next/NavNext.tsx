import { Link } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../theme'
import { useSessionUser } from '../../hooks/useSessionUser'
import UserAvatar from '../ui/UserAvatar'
import { REGISTER_PATH, SIGN_IN_PATH } from '../../lib/routes'
import { BTN_PRIMARY, CONTAINER } from './layout'

/** Lighter than the usual muted grey: these sit on the hero's photo. */
const NAV_LINK = 'text-text/80! hover:text-text! transition-colors duration-200'

export default function NavNext() {
  const { theme, toggleTheme } = useTheme()
  const user = useSessionUser()
  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <nav className={`${CONTAINER} relative z-[2] py-5 flex items-center justify-between gap-6`}>
      <div className="flex items-center gap-10 min-w-0">
        <Link to="/" className="flex items-center gap-2.5 text-text! no-underline" aria-label="Pixel Alpha — home">
          <img className="w-6 h-6 object-contain scale-[1.6]" src="/assets/logo.png" alt="" />
          <span className="font-display font-extrabold text-xl whitespace-nowrap max-[420px]:text-[17px]">Pixel Alpha</span>
        </Link>
        <div className="flex gap-6 text-sm font-medium max-[760px]:hidden">
          <Link to="/trading-bot" className={NAV_LINK}>Trading bot</Link>
          <Link to="/faq" className={NAV_LINK}>FAQ</Link>
          <Link to="/contact" className={NAV_LINK}>Contact</Link>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 max-[420px]:gap-2">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${nextTheme} theme`}
          title={`Switch to ${nextTheme} theme`}
          className="inline-flex h-11 w-11 items-center justify-center rounded-btn border border-border bg-surface text-muted cursor-pointer transition-colors duration-200 hover:text-text"
        >
          {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
        </button>
        {user ? (
          <Link to="/dashboard" className="inline-flex rounded-full" title={`${user.name} — open your dashboard`}>
            <UserAvatar user={user} size={40} />
          </Link>
        ) : (
          <>
            <Link to={SIGN_IN_PATH} className={`text-sm font-semibold px-2 whitespace-nowrap max-[420px]:px-1 ${NAV_LINK}`}>
              Sign in
            </Link>
            {/* Shorter on a phone, so the row never pushes "Sign in" off it. */}
            <Link to={REGISTER_PATH} className={`${BTN_PRIMARY} text-sm! py-2.5! no-underline whitespace-nowrap max-[420px]:px-3.5!`}>
              <span className="max-[420px]:hidden">Create account</span>
              <span className="hidden max-[420px]:inline">Sign up</span>
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
