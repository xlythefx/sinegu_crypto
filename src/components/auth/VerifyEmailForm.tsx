import { useState, type FormEvent } from 'react'
import { MailCheck } from 'lucide-react'
import CodeInput from './CodeInput'
import ConfirmModal from '../ui/ConfirmModal'
import { BUTTON, ERROR, ICON_CHIP, SUBTITLE, TITLE } from './authClasses'
import { ApiError } from '../../services/api'
import { readVerifyFailure, resendVerification, verifyEmail } from '../../services/auth'
import { useCountdown } from '../../hooks/useCountdown'
import { isCompleteCode, RESEND_COOLDOWN_SECONDS } from '../../lib/emailVerification'

interface VerifyEmailFormProps {
  email: string
  /** The code was accepted and the session user is now verified. */
  onVerified: () => void
  /** "Wrong address?" — confirmed here, performed by the page. */
  onSignOut: () => void
}

const NOTICE =
  'm-0 rounded-[10px] border border-accent-line bg-accent-soft py-2.5 px-3.5 text-[13px] leading-[1.4] text-text'

/**
 * The six-digit sign-up code screen's body: the boxes (auto-submitting on the
 * sixth digit, plus a Verify button for keyboard / assistive users), the
 * refusal line, the resend link with its cooldown, and the sign-out escape.
 *
 * A code that is expired or out of attempts can never succeed, so the boxes
 * lock until a new code is requested — only a resend unlocks it server-side.
 */
export default function VerifyEmailForm({ email, onVerified, onSignOut }: VerifyEmailFormProps) {
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  // Registration has just mailed a code, so the first resend waits too.
  const { remaining, start } = useCountdown(RESEND_COOLDOWN_SECONDS)

  const submit = async (value: string) => {
    if (!isCompleteCode(value) || submitting || locked) return
    setSubmitting(true)
    setMessage(null)
    setNotice(null)
    try {
      await verifyEmail(value)
      onVerified()
    } catch (err) {
      setCode('')
      if (err instanceof ApiError && err.errorCode === 'INVALID_CODE') {
        const { attemptsLeft, expired } = readVerifyFailure(err.payload)
        setCodeError(true)
        if (expired) {
          setLocked(true)
          setMessage('This code has expired. Request a new code below.')
        } else if (attemptsLeft === 0) {
          setLocked(true)
          setMessage('Too many wrong attempts. Request a new code below.')
        } else {
          setMessage(
            attemptsLeft === undefined
              ? 'That code is not right. Check the email and try again.'
              : `That code is not right. ${attemptsLeft} ${attemptsLeft === 1 ? 'attempt' : 'attempts'} left.`,
          )
        }
      } else if (err instanceof ApiError && err.status === 429) {
        setMessage('Too many attempts. Wait a minute and try again.')
      } else {
        setMessage(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const resend = async () => {
    if (remaining > 0 || resending) return
    setResending(true)
    setMessage(null)
    setNotice(null)
    try {
      const res = await resendVerification()
      start(res.retry_after ?? RESEND_COOLDOWN_SECONDS)
      setLocked(false)
      setCodeError(false)
      setCode('')
      setNotice(`A new code is on its way to ${email}.`)
    } catch (err) {
      if (err instanceof ApiError && err.errorCode === 'RESEND_TOO_SOON') {
        const { retryAfter } = readVerifyFailure(err.payload)
        start(retryAfter ?? RESEND_COOLDOWN_SECONDS)
        setMessage('A code was sent moments ago. You can ask again when the timer runs out.')
      } else if (err instanceof ApiError && err.status === 429) {
        setMessage('Too many requests. Wait a minute and try again.')
      } else {
        setMessage(err instanceof Error ? err.message : 'Could not send a new code. Please try again.')
      }
    } finally {
      setResending(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void submit(code)
  }

  return (
    <>
      <span className={ICON_CHIP}>
        <MailCheck size={20} />
      </span>
      <h1 className={`${TITLE} mt-4`}>Check your email</h1>
      <p className={SUBTITLE}>
        We sent a six-digit code to{' '}
        <span className="font-semibold break-all text-text">{email}</span>. Enter it below
        to confirm the address. It expires in 15 minutes.
      </p>

      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        <CodeInput
          value={code}
          onChange={(v) => {
            setCode(v)
            setCodeError(false)
          }}
          onComplete={(v) => void submit(v)}
          disabled={submitting || locked}
          error={codeError}
          autoFocus
        />
        {message && (
          <p className={ERROR} role="alert">
            {message}
          </p>
        )}
        {notice && (
          <p className={NOTICE} role="status">
            {notice}
          </p>
        )}
        <button
          type="submit"
          className={BUTTON}
          disabled={submitting || locked || !isCompleteCode(code)}
        >
          {submitting ? 'Checking…' : 'Verify email'}
        </button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-2.5 text-center text-[13px] leading-[1.5] text-muted">
        <p className="m-0">
          Didn&apos;t get it?{' '}
          {remaining > 0 ? (
            <span className="text-text">
              Resend code in <span className="font-mono">{remaining}s</span>
            </span>
          ) : (
            <button
              type="button"
              className="font-bold text-text hover:underline disabled:opacity-60"
              onClick={() => void resend()}
              disabled={resending}
            >
              {resending ? 'Sending…' : 'Resend code'}
            </button>
          )}
        </p>
        <p className="m-0">
          Wrong address?{' '}
          <button
            type="button"
            className="font-bold text-text hover:underline"
            onClick={() => setConfirmSignOut(true)}
          >
            Sign out
          </button>
        </p>
      </div>

      <ConfirmModal
        open={confirmSignOut}
        title="Sign out?"
        message="You can register again with the right email address, or sign back in later to finish verifying this one."
        confirmLabel="Yes, sign out"
        cancelLabel="No"
        onConfirm={() => {
          setConfirmSignOut(false)
          onSignOut()
        }}
        onCancel={() => setConfirmSignOut(false)}
      />
    </>
  )
}
