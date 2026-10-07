import { useState } from 'react'
import { AlertCircle, MailCheck } from 'lucide-react'
import CodeInput from '../auth/CodeInput'
import { ApiError, getApiErrorMessage } from '../../services/api'
import { readVerifyFailure, resendVerification, verifyEmail } from '../../services/auth'
import { cancelPendingEmail } from '../../services/user'
import { useCountdown } from '../../hooks/useCountdown'
import { isCompleteCode, RESEND_COOLDOWN_SECONDS } from '../../lib/emailVerification'
import { BTN_PRIMARY_SM } from './formClasses'
import type { AuthUser } from '../../types/auth'

interface PendingEmailStripProps {
  /** The new address the code was mailed to. */
  pendingEmail: string
  /**
   * True when the save that started this change happened moments ago in this
   * session — the first resend then waits out the API's cooldown. A strip
   * restored from /auth/me on a later visit starts with Resend available and
   * lets the API's `RESEND_TOO_SOON` set the real timer.
   */
  freshlySent: boolean
  /** The code was accepted; `user.email` is now the new address. */
  onVerified: (user: AuthUser) => void
  /** The change was abandoned here; `user` carries no pending address. */
  onCancelled: (user: AuthUser) => void
  /**
   * The API dropped the change (`EMAIL_TAKEN`: the address is now someone
   * else's). The pending address is already cleared server-side.
   */
  onDropped: (message: string) => void
}

const ERROR_LINE =
  'm-0 flex items-start gap-1.5 text-[12.5px] font-semibold leading-[1.45] text-red [&>svg]:mt-px [&>svg]:flex-none'
const INFO_LINE = 'm-0 text-[12.5px] leading-[1.45] text-muted'
const TEXT_LINK = 'font-bold text-text hover:underline disabled:cursor-not-allowed disabled:opacity-60'
const QUIET_LINK =
  'font-bold text-muted hover:text-text hover:underline disabled:cursor-not-allowed disabled:opacity-60'

/**
 * "Confirm your new email" — shown under the Email field while an address
 * change is waiting for its six-digit code. Same code boxes, resend cooldown
 * and refusal handling as the sign-up verify screen (`VerifyEmailForm`), in
 * a strip the Account card can hold; the two are not shared because that
 * form is a whole page body with a sign-out escape this strip must not have.
 *
 * No ConfirmModal on Cancel: the stored address was never touched, so
 * abandoning the change loses nothing.
 */
export default function PendingEmailStrip({
  pendingEmail,
  freshlySent,
  onVerified,
  onCancelled,
  onDropped,
}: PendingEmailStripProps) {
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const { remaining, start } = useCountdown(freshlySent ? RESEND_COOLDOWN_SECONDS : 0)

  const busy = submitting || resending || cancelling

  const submit = async (value: string) => {
    if (!isCompleteCode(value) || busy || locked) return
    setSubmitting(true)
    setMessage(null)
    setNotice(null)
    try {
      const user = await verifyEmail(value)
      onVerified(user)
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
      } else if (err instanceof ApiError && err.errorCode === 'EMAIL_TAKEN') {
        onDropped(
          err.message ||
            'That address is now used by another account. Your email was not changed.',
        )
      } else if (err instanceof ApiError && err.status === 429) {
        setMessage('Too many attempts. Wait a minute and try again.')
      } else {
        setMessage(getApiErrorMessage(err, 'Something went wrong. Please try again.'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const resend = async () => {
    if (remaining > 0 || busy) return
    setResending(true)
    setMessage(null)
    setNotice(null)
    try {
      const res = await resendVerification()
      start(res.retry_after ?? RESEND_COOLDOWN_SECONDS)
      setLocked(false)
      setCodeError(false)
      setCode('')
      setNotice(`A new code is on its way to ${pendingEmail}.`)
    } catch (err) {
      if (err instanceof ApiError && err.errorCode === 'RESEND_TOO_SOON') {
        const { retryAfter } = readVerifyFailure(err.payload)
        start(retryAfter ?? RESEND_COOLDOWN_SECONDS)
        setMessage('A code was sent moments ago. You can ask again when the timer runs out.')
      } else if (err instanceof ApiError && err.status === 429) {
        setMessage('Too many requests. Wait a minute and try again.')
      } else {
        setMessage(getApiErrorMessage(err, 'Could not send a new code. Please try again.'))
      }
    } finally {
      setResending(false)
    }
  }

  const cancel = async () => {
    if (busy) return
    setCancelling(true)
    setMessage(null)
    setNotice(null)
    try {
      const res = await cancelPendingEmail()
      onCancelled(res.user)
    } catch (err) {
      setMessage(getApiErrorMessage(err, 'Could not cancel the change. Please try again.'))
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div
      className="mt-1 flex flex-col gap-3.5 rounded-field border border-accent-line bg-accent-soft p-3.5 animate-[fadeup_0.3s_ease-out]"
      role="region"
      aria-label="Confirm your new email"
    >
      <div className="flex items-start gap-2.5">
        <MailCheck size={16} className="mt-px flex-none text-accent" />
        <div className="min-w-0">
          <p className="m-0 text-[13.5px] font-bold">Confirm your new email</p>
          <p className={`${INFO_LINE} mt-1`}>
            We sent a 6-digit code to{' '}
            <span className="font-semibold text-text [overflow-wrap:anywhere]">{pendingEmail}</span>
            . Your address changes once you enter it.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 sm:max-w-[300px]">
          <CodeInput
            value={code}
            onChange={(v) => {
              setCode(v)
              setCodeError(false)
            }}
            onComplete={(v) => void submit(v)}
            disabled={busy || locked}
            error={codeError}
          />
        </div>
        <button
          type="button"
          className={`${BTN_PRIMARY_SM} w-full sm:w-auto sm:flex-none`}
          onClick={() => void submit(code)}
          disabled={busy || locked || !isCompleteCode(code)}
        >
          {submitting ? 'Checking…' : 'Verify'}
        </button>
      </div>

      {message && (
        <p className={ERROR_LINE} role="alert">
          <AlertCircle size={14} />
          <span>{message}</span>
        </p>
      )}
      {notice && (
        <p className={INFO_LINE} role="status">
          {notice}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] leading-[1.5] text-muted">
        <p className="m-0">
          Didn&apos;t get it?{' '}
          {remaining > 0 ? (
            <span className="text-text">
              Resend in <span className="font-mono">{remaining}s</span>
            </span>
          ) : (
            <button
              type="button"
              className={TEXT_LINK}
              onClick={() => void resend()}
              disabled={busy}
            >
              {resending ? 'Sending…' : 'Resend code'}
            </button>
          )}
        </p>
        <button
          type="button"
          className={QUIET_LINK}
          onClick={() => void cancel()}
          disabled={busy}
        >
          {cancelling ? 'Cancelling…' : 'Cancel change'}
        </button>
      </div>
    </div>
  )
}
