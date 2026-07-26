import { useState, type FormEvent, type MouseEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useTheme } from '../theme'
import { login, register } from '../services/auth'
import { ApiError } from '../services/api'
import { isLoggedIn } from '../lib/session'
import './Auth.css'

type Mode = 'signin' | 'register'

const PANEL_BUBBLES = [
  { top: '60%', left: '18%', size: 70, blur: 2, duration: 8, delay: 0 },
  { top: '80%', left: '60%', size: 44, blur: 0, duration: 6.5, delay: 1.4 },
  { top: '70%', left: '38%', size: 100, blur: 4, duration: 10, delay: 0.7 },
]

export default function Auth() {
  // Already signed in (token in localStorage) — skip the form entirely
  if (isLoggedIn()) {
    return <Navigate to="/dashboard" replace />
  }

  return <AuthForm />
}

function AuthForm() {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('signin')
  const [glow, setGlow] = useState({ x: -120, y: -120, on: false })

  const [name, setName] = useState('')
  // TEMP: prefilled test account for local testing — remove before launch
  const [email, setEmail] = useState(import.meta.env.DEV ? 'test@sinegu.com' : '')
  const [password, setPassword] = useState(import.meta.env.DEV ? 'password123' : '')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isRegister = mode === 'register'

  const switchMode = () => {
    setMode(isRegister ? 'signin' : 'register')
    setError(null)
  }

  const copy = {
    title: isRegister ? 'Create account' : 'Sign in',
    subtitle: isRegister
      ? 'Start free — connect your exchange in minutes.'
      : 'Welcome back. Let your bots get to work.',
    cta: isRegister ? 'Create free account' : 'Sign In',
    switchPrompt: isRegister
      ? 'Already trading with us?'
      : "Don't have an account?",
    switchAction: isRegister ? 'Sign in' : 'Create one free',
    panelKicker: isRegister ? 'JOIN SINEGUALERTS' : 'WELCOME BACK',
    panelTitle: isRegister
      ? 'Keep 80% of the upside.'
      : 'Your edge, on autopilot.',
    panelBody: isRegister
      ? 'Battle-tested bots trade on your own Binance, Bybit or MEXC account. Free to start — you only pay 20% of the profit you make.'
      : 'Pick up right where your strategies left off. Funds never leave your exchange, and you keep 80% of every win.',
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (isRegister && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      if (isRegister) {
        await register(name, email, password, confirmPassword)
      } else {
        await login(email, password)
      }
      navigate('/dashboard')
    } catch (err) {
      if (err instanceof ApiError) {
        // Prefer the first field-level validation error when present
        const firstFieldError = err.errors
          ? Object.values(err.errors)[0]?.[0]
          : undefined
        setError(firstFieldError ?? err.message)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setGlow((g) => ({
      ...g,
      x: e.clientX - r.left - 210,
      y: e.clientY - r.top - 210,
    }))
  }

  return (
    <div className="auth">
      <Link to="/" className="auth__home" title="Back to home">
        ← Home
      </Link>
      <button
        className="theme-toggle auth__theme-toggle"
        title="Toggle theme"
        onClick={toggleTheme}
      >
        <span className="theme-toggle__icon">
          {theme === 'dark' ? '☀' : '☾'}
        </span>
        {theme === 'dark' ? 'Light' : 'Dark'}
      </button>

      <div className="auth__card">
        {/* LEFT: form */}
        <div
          className="auth__form-col"
          onMouseMove={onMove}
          onMouseEnter={() => setGlow((g) => ({ ...g, on: true }))}
          onMouseLeave={() => setGlow((g) => ({ ...g, on: false }))}
        >
          <div
            className="auth__glow"
            style={{
              opacity: glow.on ? 1 : 0,
              transform: `translate(${glow.x}px, ${glow.y}px)`,
            }}
          />
          <div className="auth__form-inner">
            <div className="auth__brand">
              <img className="auth__logo" src="/assets/logo.png" alt="" />
              <span className="auth__wordmark">SineguAlerts</span>
            </div>

            <h1 className="auth__title">{copy.title}</h1>
            <p className="auth__subtitle">{copy.subtitle}</p>

            <form className="auth__form" onSubmit={onSubmit}>
              {isRegister && (
                <input
                  type="text"
                  placeholder="Full name"
                  className="auth__input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              )}
              <input
                type="email"
                placeholder="Email"
                className="auth__input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                className="auth__input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={isRegister ? 8 : undefined}
              />
              {isRegister && (
                <input
                  type="password"
                  placeholder="Confirm password"
                  className="auth__input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              )}
              {!isRegister && (
                <a href="#" className="auth__forgot">
                  Forgot your password?
                </a>
              )}
              {error && (
                <p className="auth__error" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="auth__submit"
                disabled={loading}
              >
                {loading ? 'Please wait…' : copy.cta}
              </button>
            </form>

            <p className="auth__switch">
              {copy.switchPrompt}{' '}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  switchMode()
                }}
              >
                {copy.switchAction}
              </a>
            </p>
          </div>
        </div>

        {/* RIGHT: brand panel */}
        <div className="auth__panel">
          <div className="auth__panel-bubbles">
            {PANEL_BUBBLES.map((b, i) => (
              <div
                className="auth__panel-bubble"
                key={i}
                style={{
                  top: b.top,
                  left: b.left,
                  width: b.size,
                  height: b.size,
                  filter: b.blur ? `blur(${b.blur}px)` : undefined,
                  animationDuration: `${b.duration}s`,
                  animationDelay: `${b.delay}s`,
                }}
              />
            ))}
          </div>
          <div className="auth__panel-inner">
            <span className="auth__panel-kicker">[ {copy.panelKicker} ]</span>
            <h2 className="auth__panel-title">{copy.panelTitle}</h2>
            <p className="auth__panel-body">{copy.panelBody}</p>
            <div className="auth__panel-stats">
              <div>
                <div className="auth__panel-stat-value">48.2K</div>
                traders
              </div>
              <div>
                <div className="auth__panel-stat-value">$128M</div>
                profit
              </div>
              <div>
                <div className="auth__panel-stat-value">20%</div>
                our cut
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
