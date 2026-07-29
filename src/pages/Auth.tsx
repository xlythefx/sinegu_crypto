import { useState, type FormEvent, type MouseEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useTheme } from '../theme'
import { login, register } from '../services/auth'
import { ApiError } from '../services/api'
import { isLoggedIn } from '../lib/session'

type Mode = 'signin' | 'register'

const PANEL_BUBBLES = [
  { top: '60%', left: '18%', size: 70, blur: 2, duration: 8, delay: 0 },
  { top: '80%', left: '60%', size: 44, blur: 0, duration: 6.5, delay: 1.4 },
  { top: '70%', left: '38%', size: 100, blur: 4, duration: 10, delay: 0.7 },
]

/* ---------- shared class-strings (was .auth__* in Auth.css) ---------- */
const INPUT =
  'h-12 w-full border border-border rounded-[12px] bg-surface2 px-4 text-[14px] text-text outline-none font-body transition-[border-color,box-shadow] duration-200 focus:border-accent focus:shadow-[0_0_0_3px_var(--glowAuth)]'

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
  const [searchParams] = useSearchParams()
  // Referral code from an invite link (/auth?ref=CODE) — invalid codes are
  // silently ignored server-side, so no client validation is needed.
  const refCode = searchParams.get('ref')?.trim().toUpperCase() || null
  const [mode, setMode] = useState<Mode>(refCode ? 'register' : 'signin')
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
        await register(name, email, password, confirmPassword, refCode ?? undefined)
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
    <div className="relative flex min-h-screen items-center justify-center bg-bg p-6 text-text transition-[background,color] duration-[400ms]">
      <Link
        to="/"
        className="absolute top-[22px] left-6 z-[5] flex cursor-pointer items-center gap-2 rounded-pill border border-border bg-surface py-[9px] pr-4 pl-3 font-mono text-[12px] text-text"
        title="Back to home"
      >
        ← Home
      </Link>
      <button
        className="absolute top-[22px] right-6 z-[5] flex items-center gap-2 font-mono text-[12px] bg-surface text-text border border-border py-[9px] px-3.5 rounded-pill cursor-pointer"
        title="Toggle theme"
        onClick={toggleTheme}
      >
        <span className="text-[14px]">{theme === 'dark' ? '☀' : '☾'}</span>
        {theme === 'dark' ? 'Light' : 'Dark'}
      </button>

      <div className="grid w-full max-w-[960px] grid-cols-2 min-h-[600px] overflow-hidden rounded-[24px] border border-border bg-surface shadow-[0_40px_100px_rgba(0,0,0,0.35)] animate-[fadeup_0.6s_cubic-bezier(0.2,0.7,0.2,1)_both] max-[760px]:grid-cols-1">
        {/* LEFT: form */}
        <div
          className="relative flex flex-col justify-center overflow-hidden py-12 px-[52px] max-[760px]:py-10 max-[760px]:px-7"
          onMouseMove={onMove}
          onMouseEnter={() => setGlow((g) => ({ ...g, on: true }))}
          onMouseLeave={() => setGlow((g) => ({ ...g, on: false }))}
        >
          <div
            className="pointer-events-none absolute top-0 left-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,var(--glowAuth),transparent_70%)] blur-[30px] transition-opacity duration-[250ms]"
            style={{
              opacity: glow.on ? 1 : 0,
              transform: `translate(${glow.x}px, ${glow.y}px)`,
            }}
          />
          <div className="relative z-[1]">
            <div className="mb-[26px] flex items-center gap-2.5">
              <img
                className="h-[26px] w-[26px] scale-[1.6] object-contain"
                src="/assets/logo.png"
                alt=""
              />
              <span className="font-display text-[19px] font-extrabold">
                SineguAlerts
              </span>
            </div>

            <h1 className="mb-1.5 font-display text-[34px] font-extrabold tracking-[-0.02em]">
              {copy.title}
            </h1>
            <p className="mb-6 text-[14px] text-muted">{copy.subtitle}</p>

            <form className="flex flex-col gap-3.5" onSubmit={onSubmit}>
              {isRegister && (
                <input
                  type="text"
                  placeholder="Full name"
                  className={INPUT}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              )}
              <input
                type="email"
                placeholder="Email"
                className={INPUT}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                className={INPUT}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={isRegister ? 8 : undefined}
              />
              {isRegister && (
                <input
                  type="password"
                  placeholder="Confirm password"
                  className={INPUT}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              )}
              {!isRegister && (
                <a
                  href="#"
                  className="self-start text-[13px] text-muted"
                >
                  Forgot your password?
                </a>
              )}
              {error && (
                <p
                  className="m-0 rounded-[10px] border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] py-2.5 px-3.5 text-[13px] leading-[1.4] text-[#ef4444]"
                  role="alert"
                >
                  {error}
                </p>
              )}
              {isRegister && refCode && (
                <p className="m-0 self-start inline-flex items-center gap-1.5 rounded-pill border border-accent-line bg-accent-soft py-1.5 px-3 font-mono text-[11.5px] text-accent">
                  Referral code applied:{' '}
                  <span className="font-bold tracking-[0.08em]">{refCode}</span>
                </p>
              )}
              <button
                type="submit"
                className="relative mt-1 h-12 overflow-hidden rounded-[12px] border-0 bg-accent font-body text-[15px] font-bold text-on-accent shadow-[0_10px_24px_var(--glowAuth)] transition-transform duration-200 hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
              >
                {loading ? 'Please wait…' : copy.cta}
              </button>
            </form>

            <p className="mt-[22px] text-center text-[13.5px] text-muted">
              {copy.switchPrompt}{' '}
              <a
                href="#"
                className="font-bold"
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
        <div className="relative flex flex-col justify-center overflow-hidden border-l border-border bg-[linear-gradient(155deg,var(--accentSoft),var(--surface2))] py-[52px] px-12 max-[760px]:border-l-0 max-[760px]:border-t">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {PANEL_BUBBLES.map((b, i) => (
              <div
                className="absolute rounded-full bg-[var(--glowAuth)] animate-[bubble_ease-in_infinite]"
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
          <div className="relative z-[1]">
            <span className="font-mono text-[11px] tracking-[0.16em] text-accent">
              [ {copy.panelKicker} ]
            </span>
            <h2 className="my-3.5 font-display text-[34px] font-extrabold leading-[1.08] tracking-[-0.02em]">
              {copy.panelTitle}
            </h2>
            <p className="mb-7 max-w-[320px] text-[15px] leading-[1.6] text-muted">
              {copy.panelBody}
            </p>
            <div className="mt-2 flex gap-6 font-mono text-[12px] text-faint">
              <div>
                <div className="font-display text-[22px] font-extrabold text-text">
                  48.2K
                </div>
                traders
              </div>
              <div>
                <div className="font-display text-[22px] font-extrabold text-text">
                  $128M
                </div>
                profit
              </div>
              <div>
                <div className="font-display text-[22px] font-extrabold text-text">
                  20%
                </div>
                our cut
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
