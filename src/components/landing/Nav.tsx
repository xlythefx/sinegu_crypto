import { Link, useNavigate } from 'react-router-dom'
import { useTheme } from '../../theme'
import { useSessionUser } from '../../hooks/useSessionUser'
import UserAvatar from '../ui/UserAvatar'
import { REGISTER_PATH } from '../../lib/routes'

const CONTAINER = 'max-w-[1280px] mx-auto px-10 max-[560px]:px-5'

export default function Nav() {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const user = useSessionUser()

  return (
    <nav
      className={`${CONTAINER} py-5 flex items-center justify-between gap-8 flex-wrap`}
    >
      <div className="flex items-center gap-11 flex-wrap">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-text! no-underline"
          aria-label="Pixel Alpha — home"
        >
          <img
            className="w-6 h-6 object-contain scale-[1.6]"
            src="/assets/logo.png"
            alt=""
          />
          <span className="font-display font-extrabold text-xl">
            Pixel Alpha
          </span>
        </Link>
        <div className="flex gap-[26px] text-sm font-medium text-muted whitespace-nowrap max-[560px]:hidden">
          <Link to="/trading-bot" className="text-muted! hover:text-text!">
            Trading Bot
          </Link>
          <Link to="/faq" className="text-muted! hover:text-text!">
            FAQ
          </Link>
          <Link to="/contact" className="text-muted! hover:text-text!">
            Contact
          </Link>
        </div>
      </div>
      <div className="flex items-center gap-3.5 shrink-0">
        <button
          className="flex items-center gap-2 font-mono text-xs bg-surface text-text border border-border py-[9px] px-3.5 rounded-pill cursor-pointer"
          title="Toggle theme"
          onClick={toggleTheme}
        >
          <span className="text-sm">{theme === 'dark' ? '☀' : '☾'}</span>
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        {user ? (
          <Link
            to="/dashboard"
            className="inline-flex rounded-full transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-[0_6px_16px_var(--glowAuth)]"
            title={`${user.name} — go to dashboard`}
          >
            <UserAvatar user={user} size={38} />
          </Link>
        ) : (
          <>
            <Link
              to="/auth"
              className="text-sm font-semibold cursor-pointer text-muted!"
            >
              Sign in
            </Link>
            <button
              className="font-body text-sm bg-accent text-white border-none py-[11px] px-5 rounded-pill font-bold cursor-pointer"
              onClick={() => navigate(REGISTER_PATH)}
            >
              Register
            </button>
          </>
        )}
      </div>
    </nav>
  )
}
