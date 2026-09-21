import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { CheckCircle2, KeyRound, MailCheck } from 'lucide-react'
import { forgotPassword, resetPassword } from '../services/auth'
import { ApiError } from '../services/api'
import { isLoggedIn } from '../lib/session'

type Step = 'email' | 'code' | 'done'

// Same field styling as the sign-in form (`pages/Auth.tsx`).
const INPUT =
  'h-12 w-full border border-border rounded-[12px] bg-surface2 px-4 text-[14px] text-text outline-none font-body transition-[border-color,box-shadow] duration-200 focus:border-accent focus:shadow-[0_0_0_3px_var(--glowAuth)]'
const BUTTON =
  'relative mt-1 h-12 rounded-[12px] border-0 bg-accent font-body text-[15px] font-bold text-on-accent shadow-[0_10px_24px_var(--glowAuth)] transition-transform duration-200 hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60'
const ERROR =
  'm-0 rounded-[10px] border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] py-2.5 px-3.5 text-[13px] leading-[1.4] text-[#ef4444]'

/**
 * `/auth/forgot` — request a six-digit code, redeem it with a new password.
 *
 * The email step always succeeds for a well-formed address (the API never
 * says whether it is registered), so the code step is shown regardless and
 * the copy says "if that email has an account".
 */
export default function ForgotPassword() {
  if (isLoggedIn()) return <Navigate to="/dashboard" replace />
  return <ForgotPasswordForm />
}

function ForgotPasswordForm() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fail = (err: unknown) => {
    if (err instanceof ApiError) {
      const firstFieldError = err.errors ? Object.values(err.errors)[0]?.[0] : undefined
      setError(
        err.status === 429
          ? 'Too many attempts. Wait a minute and try again.'
          : (firstFieldError ?? err.message),
      )
    } else {
      setError('Something went wrong. Please try again.')
    }
  }

  const sendCode = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await forgotPassword(email.trim())
      setStep('code')
    } catch (err) {
      fail(err)
    } finally {
      setLoading(false)
    }
  }

  const redeem = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await resetPassword(email.trim(), code.trim(), password, confirm)
      setStep('done')
    } catch (err) {
      fail(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg p-6 text-text">
      <Link
        to="/auth"
        className="absolute top-[22px] left-6 z-[5] flex items-center gap-2 rounded-pill border border-border bg-surface py-[9px] pr-4 pl-3 font-mono text-[12px] text-text"
      >
        ← Sign in
      </Link>

      <div className="w-full max-w-[460px] rounded-[24px] border border-border bg-surface p-[44px] shadow-[0_40px_100px_rgba(0,0,0,0.35)] animate-[fadeup_0.6s_cubic-bezier(0.2,0.7,0.2,1)_both] max-[560px]:p-7">
        <div className="mb-6 flex items-center gap-2.5">
          <img className="h-[26px] w-[26px] scale-[1.6] object-contain" src="/assets/logo.png" alt="" />
          <span className="font-display text-[19px] font-extrabold">Pixel Alpha</span>
        </div>

        {step === 'email' && (
          <>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-btn border border-accent-line bg-accent-soft text-accent">
              <KeyRound size={20} />
            </span>
            <h1 className="mt-4 mb-1.5 font-display text-[28px] font-extrabold tracking-[-0.02em]">
              Reset your password
            </h1>
            <p className="mb-6 text-[14px] leading-[1.6] text-muted">
              Enter the email on your account and we'll send a six-digit code.
            </p>
            <form className="flex flex-col gap-3.5" onSubmit={sendCode}>
              <input
                type="email"
                placeholder="Email"
                className={INPUT}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
              {error && <p className={ERROR} role="alert">{error}</p>}
              <button type="submit" className={BUTTON} disabled={loading}>
                {loading ? 'Sending…' : 'Send code'}
              </button>
            </form>
          </>
        )}

        {step === 'code' && (
          <>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-btn border border-accent-line bg-accent-soft text-accent">
              <MailCheck size={20} />
            </span>
            <h1 className="mt-4 mb-1.5 font-display text-[28px] font-extrabold tracking-[-0.02em]">
              Check your inbox
            </h1>
            <p className="mb-6 text-[14px] leading-[1.6] text-muted">
              If <span className="font-semibold text-text">{email}</span> has an
              account, a code is on its way. It expires in 15 minutes.
            </p>
            <form className="flex flex-col gap-3.5" onSubmit={redeem}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                placeholder="6-digit code"
                className={`${INPUT} font-mono tracking-[0.3em]`}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
                required
              />
              <input
                type="password"
                placeholder="New password"
                className={INPUT}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
              <input
                type="password"
                placeholder="Confirm new password"
                className={INPUT}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              {error && <p className={ERROR} role="alert">{error}</p>}
              <button type="submit" className={BUTTON} disabled={loading}>
                {loading ? 'Please wait…' : 'Set new password'}
              </button>
            </form>
            <p className="mt-5 text-center text-[13px] text-muted">
              Nothing arrived?{' '}
              <button
                type="button"
                className="font-bold text-text"
                onClick={() => {
                  setStep('email')
                  setError(null)
                }}
              >
                Try again
              </button>
            </p>
          </>
        )}

        {step === 'done' && (
          <>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-btn border border-accent-line bg-accent-soft text-accent">
              <CheckCircle2 size={20} />
            </span>
            <h1 className="mt-4 mb-1.5 font-display text-[28px] font-extrabold tracking-[-0.02em]">
              Password updated
            </h1>
            <p className="mb-6 text-[14px] leading-[1.6] text-muted">
              Every device has been signed out. Sign in with your new password.
            </p>
            <button type="button" className={`${BUTTON} w-full`} onClick={() => navigate('/auth')}>
              Go to sign in
            </button>
          </>
        )}
      </div>
    </div>
  )
}
