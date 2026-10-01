import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { CheckCircle2, KeyRound, MailCheck } from 'lucide-react'
import { forgotPassword, resetPassword } from '../services/auth'
import { ApiError } from '../services/api'
import { isLoggedIn } from '../lib/session'
import AuthFrame, { AuthBrand } from '../components/auth/AuthFrame'
import { BUTTON, ERROR, ICON_CHIP, INPUT } from '../components/auth/authClasses'
import CodeInput from '../components/auth/CodeInput'
import { isCompleteCode } from '../lib/emailVerification'

type Step = 'email' | 'code' | 'done'

const H1 = 'mt-4 mb-1.5 font-display text-[28px] font-extrabold tracking-[-0.02em]'
const LEDE = 'mb-6 text-[14px] leading-[1.6] text-muted'

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
  const [codeError, setCodeError] = useState(false)
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
    if (!isCompleteCode(code)) {
      setError('Enter the six-digit code from the email.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await resetPassword(email.trim(), code, password, confirm)
      setStep('done')
    } catch (err) {
      if (err instanceof ApiError && err.errorCode === 'INVALID_CODE') {
        // Shake and clear the boxes; the passwords stay typed.
        setCode('')
        setCodeError(true)
      }
      fail(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthFrame back={{ to: '/auth', label: '← Sign in' }}>
      <AuthBrand />

      {step === 'email' && (
        <>
          <span className={ICON_CHIP}>
            <KeyRound size={20} />
          </span>
          <h1 className={H1}>Reset your password</h1>
          <p className={LEDE}>
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
          <span className={ICON_CHIP}>
            <MailCheck size={20} />
          </span>
          <h1 className={H1}>Check your inbox</h1>
          <p className={LEDE}>
            If <span className="font-semibold text-text">{email}</span> has an
            account, a code is on its way. It expires in 15 minutes.
          </p>
          <form className="flex flex-col gap-3.5" onSubmit={redeem}>
            <CodeInput
              value={code}
              onChange={(v) => {
                setCode(v)
                setCodeError(false)
              }}
              error={codeError}
              disabled={loading}
              autoFocus
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
          <span className={ICON_CHIP}>
            <CheckCircle2 size={20} />
          </span>
          <h1 className={H1}>Password updated</h1>
          <p className={LEDE}>
            Every device has been signed out. Sign in with your new password.
          </p>
          <button type="button" className={`${BUTTON} w-full`} onClick={() => navigate('/auth')}>
            Go to sign in
          </button>
        </>
      )}
    </AuthFrame>
  )
}
