import { Link, useNavigate } from 'react-router-dom'
import { useTheme } from '../../theme'
import { useSessionUser } from '../../hooks/useSessionUser'
import UserAvatar from '../ui/UserAvatar'

export default function Nav() {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const user = useSessionUser()

  return (
    <nav className="nav container">
      <div className="nav__left">
        <div className="nav__brand">
          <img className="logo-mark" src="/assets/logo.png" alt="" />
          <span className="nav__wordmark">SineguAlerts</span>
        </div>
        <div className="nav__links">
          <span>Structure</span>
          <span>Exchanges</span>
          <span>Pricing</span>
        </div>
      </div>
      <div className="nav__right">
        <button
          className="theme-toggle"
          title="Toggle theme"
          onClick={toggleTheme}
        >
          <span className="theme-toggle__icon">
            {theme === 'dark' ? '☀' : '☾'}
          </span>
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        {user ? (
          <Link
            to="/dashboard"
            className="nav__avatar"
            title={`${user.name} — go to dashboard`}
          >
            <UserAvatar user={user} size={38} />
          </Link>
        ) : (
          <>
            <Link to="/auth" className="nav__signin">
              Sign in
            </Link>
            <button className="btn-primary" onClick={() => navigate('/auth')}>
              Start free
            </button>
          </>
        )}
      </div>
    </nav>
  )
}
