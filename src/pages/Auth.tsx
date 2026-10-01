import { useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { login, register } from '../services/auth'
import { getDiscordConfig } from '../services/discord'
import { ApiError } from '../services/api'
import { isLoggedIn } from '../lib/session'
import { postAuthPath, VERIFY_EMAIL_PATH } from '../lib/emailVerification'
import { normaliseReferralCode, recallReferralCode, rememberReferralCode } from '../lib/referral'
import { useApiData } from '../hooks/useApiData'
import AuthFrame, { AuthBrand } from '../components/auth/AuthFrame'
import DiscordButton from '../components/auth/DiscordButton'
import {
  BUTTON,
  CHECKBOX,
  CHECKBOX_LABEL,
  ERROR,
  INPUT,
  LINK,
  PILL,
} from '../components/auth/authClasses'

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
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  // Referral code from an invite link (/auth?ref=CODE) — invalid codes are
  // silently ignored server-side, so no client validation is needed. A code
  // that arrived on an earlier visit is recalled, so "Continue with Discord"
  // (which leaves the page) still credits the affiliate.
  const refCode = normaliseReferralCode(searchParams.get('ref')) ?? recallReferralCode()
  useEffect(() => rememberReferralCode(refCode), [refCode])

  /*
   * Which form opens. Every "Register" CTA links to `/auth?mode=register`
   * (lib/routes.ts) — without it they all landed on Sign in, so someone who
   * had just been invited to create an account had to find the switch at the
   * bottom of the panel first. An invite link (`?ref=`) means the same thing
   * and keeps working on its own.
   */
  const [mode, setMode] = useState<Mode>(
    searchParams.get('mode') === 'register' || refCode ? 'register' : 'signin',
  )
  const [glow, setGlow] = useState({ x: -120, y: -120, on: false })

  const [name, setName] = useState('')
  // TEMP: prefilled test account for local testing — remove before launch
  const [email, setEmail] = useState(import.meta.env.DEV ? 'test@sinegu.com' : '')
  const [password, setPassword] = useState(import.meta.env.DEV ? 'password123' : '')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Whether the Discord button is shown. Any failure reads as "off", so an
  // older API or a network blip just leaves the classic form.
  const discord = useApiData(getDiscordConfig)
  const discordEnabled = discord.data?.enabled === true

  const isRegister = mode === 'register'

  const switchMode = () => {
    const next: Mode = isRegister ? 'signin' : 'register'
    setMode(next)
    setError(null)
    // Keep the URL saying which form is open, so a refresh (or a link someone
    // copies mid-signup) comes back to the same one. `replace` so flipping
    // between the two does not fill the back button with dead steps; any
    // ?ref= already on the URL is preserved.
    const params = new URLSearchParams(searchParams)
    params.set('mode', next)
    setSearchParams(params, { replace: true })
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
    panelKicker: isRegister ? 'JOIN PIXEL ALPHA' : 'WELCOME BACK',
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
    // The checkbox is `required`, so the browser blocks submit first; this is
    // the belt for a browser that does not enforce it.
    if (isRegister && !termsAccepted) {
      setError('Please accept the Terms to create an account.')
      return
    }

    setLoading(true)
    try {
      if (isRegister) {
        await register(name, email, password, confirmPassword, refCode ?? undefined)
        // Registration mails a six-digit code; the account is unusable until
        // it is redeemed. (A verified answer there bounces on to /dashboard.)
        navigate(VERIFY_EMAIL_PATH)
      } else {
        const { user } = await login(email, password)
        navigate(postAuthPath(user))
      }
    } catch (err) {
      if (err instanceof ApiError) {
        // Prefer the first field-level validation error when present
        const firstFieldError = err.errors
          ? Object.values(err.errors)[0]?.[0]
          : undefined
        setError(
          err.status === 429
            ? 'Too many attempts. Wait a minute and try again.'
            : err.errorCode === 'DISCORD_ONLY'
              ? 'This account signs in with Discord — use the Discord button below.'
              : (firstFieldError ?? err.message),
        )
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
    <AuthFrame width="wide">
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
          <AuthBrand />

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
            {isRegister && (
              <label className={CHECKBOX_LABEL}>
                <input
                  type="checkbox"
                  className={CHECKBOX}
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  required
                />
                <span>
                  I have read and agree to the{' '}
                  <Link to="/terms" target="_blank" className={LINK}>
                    Terms
                  </Link>
                  ,{' '}
                  <Link to="/privacy" target="_blank" className={LINK}>
                    Privacy Policy
                  </Link>{' '}
                  and{' '}
                  <Link to="/risk" target="_blank" className={LINK}>
                    Risk Disclosure
                  </Link>
                  , and I understand that leveraged trading can lose my capital.
                </span>
              </label>
            )}
            {!isRegister && (
              <Link
                to="/auth/forgot"
                className="self-start text-[13px] text-muted hover:text-text"
              >
                Forgot your password?
              </Link>
            )}
            {error && (
              <p className={ERROR} role="alert">
                {error}
              </p>
            )}
            {isRegister && refCode && (
              <p className={PILL}>
                Referral code applied:{' '}
                <span className="font-bold tracking-[0.08em]">{refCode}</span>
              </p>
            )}
            <button type="submit" className={BUTTON} disabled={loading}>
              {loading ? 'Please wait…' : copy.cta}
            </button>
          </form>

          {discordEnabled && (
            <DiscordButton
              divider
              label={isRegister ? 'Sign up with Discord' : 'Continue with Discord'}
              onClick={() => navigate('/auth/discord/start?intent=login')}
            />
          )}

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
      <div className="relative flex flex-col justify-center overflow-hidden border-l border-border bg-[linear-gradient(155deg,var(--accentSoft),var(--surface2))] py-[52px] px-12 max-[760px]:border-l-0 max-[760px]:border-t max-[760px]:px-7 max-[760px]:py-9">
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
    </AuthFrame>
  )
}
