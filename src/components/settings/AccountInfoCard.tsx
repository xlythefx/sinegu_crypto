import { useState } from 'react'
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  KeyRound,
  Mail,
  Pencil,
  Save,
  Shield,
  User,
  X,
} from 'lucide-react'
import PendingEmailStrip from './PendingEmailStrip'
import { ApiError, getApiErrorMessage } from '../../services/api'
import { updateProfile } from '../../services/user'
import { saveUser, updateStoredUser } from '../../lib/session'
import { formatDate } from '../../lib/format'
import {
  BTN_GHOST_SM,
  BTN_PRIMARY_SM,
  CARD,
  CARD_HEAD,
  CARD_SUB,
  CARD_TITLE,
  CARD_TITLES,
  CHIP,
  FIELD,
  FIELDS,
  FORM,
  FORM_ACTIONS,
  LABEL,
  LOADING,
  VALUE,
  VALUE_LG,
  INPUT,
  badge,
  notice as noticeCls,
} from './formClasses'
import type { AuthUser } from '../../types/auth'

interface AccountInfoCardProps {
  user: AuthUser | null
  loading: boolean
  onUserChange: (user: AuthUser) => void
}

type Notice = { kind: 'success' | 'error'; text: string } | null

/** Errors pinned to the field they belong to, rather than the card's notice. */
interface FieldErrors {
  email?: string
  password?: string
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  pending: 'Pending',
  suspended: 'Suspended',
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const PASSWORD_REQUIRED_MSG = 'Enter your current password to change your email.'
const NO_PASSWORD_MSG = 'Set a password before changing your email.'

const FIELD_HELP = 'm-0 text-[12px] leading-[1.45] text-muted'
const FIELD_LINE =
  'm-0 flex items-start gap-1.5 text-[12px] font-semibold leading-[1.45] [&>svg]:mt-px [&>svg]:flex-none'
const FIELD_ERROR = `${FIELD_LINE} text-red`
const FIELD_WARN = `${FIELD_LINE} text-accent`
/** Appended to INPUT: a red border while the field carries an error. */
const INPUT_INVALID = 'aria-[invalid=true]:border-red'

/**
 * Name / email / status / member-since — wired to GET /auth/me + PUT /user/profile.
 *
 * Changing the email is a two-step act: the save needs the current password
 * (the API refuses it otherwise) and only mails a code to the NEW address;
 * `user.pending_email` then shows the confirm strip under the Email field
 * until the code is entered, and `user.email` keeps the old, working address
 * meanwhile. A Discord-only account (`has_password === false`) has no password
 * to give, so it is told to set one first and cannot submit a changed email.
 */
export default function AccountInfoCard({
  user,
  loading,
  onUserChange,
}: AccountInfoCardProps) {
  const [editMode, setEditMode] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  // True only right after a save in THIS session mailed the code, so the
  // strip's first resend waits out the cooldown; false for a strip restored
  // from /auth/me, where that code may be hours old.
  const [freshlySent, setFreshlySent] = useState(false)
  // Keeps the password field open after the API asked for (or refused) a
  // password, even if the typed email no longer reads as changed here — a
  // session whose stored email drifted from the server's would otherwise
  // pin an error to a field that is not on screen.
  const [passwordPinned, setPasswordPinned] = useState(false)

  const status = user?.status ?? ''
  const statusBadge = (
    <span className={badge(status)}>
      {STATUS_LABELS[status] ?? (status || '—')}
    </span>
  )

  const storedEmail = user?.email ?? ''
  const pendingEmail = user?.pending_email ?? null
  const noPassword = user?.has_password === false
  const emailChanged = editMode && email.trim() !== storedEmail
  const needsPassword = (emailChanged || passwordPinned) && !noPassword
  const blockedByNoPassword = emailChanged && noPassword
  const hasEmailNote = Boolean(fieldErrors.email || blockedByNoPassword || pendingEmail)

  const startEdit = () => {
    setName(user?.name ?? '')
    setEmail(storedEmail)
    setCurrentPassword('')
    setPasswordPinned(false)
    setFieldErrors({})
    setNotice(null)
    setEditMode(true)
  }

  const cancelEdit = () => {
    setEditMode(false)
    setCurrentPassword('')
    setPasswordPinned(false)
    setFieldErrors({})
    setNotice(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    const changed = trimmedEmail !== storedEmail

    setFieldErrors({})
    setNotice(null)
    if (!trimmedName || !trimmedEmail) {
      setNotice({ kind: 'error', text: 'Please fill in both name and email.' })
      return
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setFieldErrors({ email: 'Please enter a valid email address.' })
      return
    }
    if (changed && noPassword) {
      setFieldErrors({ email: NO_PASSWORD_MSG })
      return
    }
    if (changed && !currentPassword) {
      setFieldErrors({ password: PASSWORD_REQUIRED_MSG })
      return
    }

    setSaving(true)
    try {
      // Sent whenever one was typed: the field is only on screen when the
      // email changed or the API asked for it, and both are reasons to send.
      const res = await updateProfile(trimmedName, trimmedEmail, currentPassword || undefined)
      saveUser(res.user)
      onUserChange(res.user)
      setEditMode(false)
      setCurrentPassword('')
      setPasswordPinned(false)
      if (res.user.pending_email) {
        setFreshlySent(true)
        setNotice({
          kind: 'success',
          text:
            res.message ||
            `We sent a code to ${res.user.pending_email}. Your email changes once you enter it below.`,
        })
      } else {
        setNotice({
          kind: 'success',
          text: res.message || 'Profile updated successfully.',
        })
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.errorCode === 'PASSWORD_REQUIRED') {
          setPasswordPinned(true)
          setFieldErrors({ password: PASSWORD_REQUIRED_MSG })
          return
        }
        if (err.errorCode === 'INVALID_PASSWORD') {
          setPasswordPinned(true)
          setFieldErrors({ password: 'That password is not right. Try again.' })
          return
        }
        if (err.errorCode === 'NO_PASSWORD') {
          setFieldErrors({ email: NO_PASSWORD_MSG })
          return
        }
        // Laravel validation on a field this form renders stays on the field.
        const emailError = err.errors?.email?.join(' ')
        const passwordError = err.errors?.current_password?.join(' ')
        if (emailError || passwordError) {
          if (passwordError) setPasswordPinned(true)
          setFieldErrors({ email: emailError, password: passwordError })
          return
        }
      }
      setNotice({
        kind: 'error',
        text: getApiErrorMessage(err, 'Unable to update profile. Please try again.'),
      })
    } finally {
      setSaving(false)
    }
  }

  // verifyEmail() has already stored the user; the page just needs to know.
  const handleVerified = (verified: AuthUser) => {
    onUserChange(verified)
    setFreshlySent(false)
    setNotice({ kind: 'success', text: `Your email is now ${verified.email}.` })
  }

  const handleCancelled = (unchanged: AuthUser) => {
    saveUser(unchanged)
    onUserChange(unchanged)
    setFreshlySent(false)
    setNotice({
      kind: 'success',
      text: `Email change cancelled. Your address stays ${unchanged.email}.`,
    })
  }

  // The API already dropped the pending address; mirror that locally so the
  // strip goes away without waiting for the next /auth/me.
  const handleDropped = (message: string) => {
    updateStoredUser({ pending_email: null })
    if (user) onUserChange({ ...user, pending_email: null })
    setFreshlySent(false)
    setNotice({ kind: 'error', text: message })
  }

  return (
    <section className={`${CARD} flex flex-col`} data-aos="fade-up">
      <div className={CARD_HEAD}>
        <span className={CHIP}>
          <User size={15} />
        </span>
        <div className={CARD_TITLES}>
          <h3 className={CARD_TITLE}>Account Information</h3>
          <p className={CARD_SUB}>Your personal account details</p>
        </div>
        {!loading && !editMode && (
          <button type="button" className={BTN_GHOST_SM} onClick={startEdit}>
            <Pencil size={13} />
            Edit
          </button>
        )}
      </div>

      {notice && (
        <div className={noticeCls(notice.kind)} role="status">
          {notice.kind === 'success' ? (
            <CheckCircle2 size={15} />
          ) : (
            <AlertCircle size={15} />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {loading && !user ? (
        <p className={LOADING}>Loading account…</p>
      ) : editMode ? (
        <form className={FORM} onSubmit={handleSubmit}>
          <div className={FIELD}>
            <label className={LABEL} htmlFor="acc-name">
              <User size={13} />
              Full Name
            </label>
            <input
              id="acc-name"
              className={INPUT}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              autoComplete="name"
              disabled={saving}
              required
            />
          </div>
          <div className={FIELD}>
            <label className={LABEL} htmlFor="acc-email">
              <Mail size={13} />
              Email Address
            </label>
            <input
              id="acc-email"
              className={`${INPUT} ${INPUT_INVALID}`}
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }))
              }}
              placeholder="Enter your email address"
              autoComplete="email"
              aria-invalid={fieldErrors.email ? true : undefined}
              aria-describedby={hasEmailNote ? 'acc-email-note' : undefined}
              disabled={saving}
              required
            />
            {fieldErrors.email ? (
              <p id="acc-email-note" className={FIELD_ERROR} role="alert">
                <AlertCircle size={14} />
                <span>{fieldErrors.email}</span>
              </p>
            ) : blockedByNoPassword ? (
              <p id="acc-email-note" className={FIELD_WARN} role="status">
                <AlertCircle size={14} />
                <span>{NO_PASSWORD_MSG}</span>
              </p>
            ) : pendingEmail ? (
              <p id="acc-email-note" className={FIELD_HELP}>
                A change to{' '}
                <span className="font-semibold text-text [overflow-wrap:anywhere]">
                  {pendingEmail}
                </span>{' '}
                is still waiting for its code. Cancel editing to enter it, or save
                a different address to replace it.
              </p>
            ) : null}
          </div>
          {needsPassword && (
            <div className={`${FIELD} animate-[fadeup_0.25s_ease-out]`}>
              <label className={LABEL} htmlFor="acc-current-password">
                <KeyRound size={13} />
                Current Password
              </label>
              <input
                id="acc-current-password"
                className={`${INPUT} ${INPUT_INVALID}`}
                type="password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value)
                  if (fieldErrors.password) {
                    setFieldErrors((f) => ({ ...f, password: undefined }))
                  }
                }}
                placeholder="Enter your current password"
                autoComplete="current-password"
                aria-invalid={fieldErrors.password ? true : undefined}
                aria-describedby="acc-current-password-note"
                disabled={saving}
              />
              {fieldErrors.password ? (
                <p id="acc-current-password-note" className={FIELD_ERROR} role="alert">
                  <AlertCircle size={14} />
                  <span>{fieldErrors.password}</span>
                </p>
              ) : (
                <p id="acc-current-password-note" className={FIELD_HELP}>
                  Changing your email needs your password. We&apos;ll send a code to
                  the new address.
                </p>
              )}
            </div>
          )}
          <div className={FIELD}>
            <span className={LABEL}>
              <Shield size={13} />
              Account Status
            </span>
            <div>{statusBadge}</div>
          </div>
          <div className={FIELD}>
            <span className={LABEL}>
              <Calendar size={13} />
              Member Since
            </span>
            <p className={VALUE}>{formatDate(user?.created_at)}</p>
          </div>
          <div className={FORM_ACTIONS}>
            <button
              type="button"
              className={BTN_GHOST_SM}
              onClick={cancelEdit}
              disabled={saving}
            >
              <X size={13} />
              Cancel
            </button>
            <button
              type="submit"
              className={BTN_PRIMARY_SM}
              disabled={saving || blockedByNoPassword}
            >
              <Save size={13} />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className={FIELDS}>
            <div className={FIELD}>
              <span className={LABEL}>
                <User size={13} />
                Full Name
              </span>
              <p className={VALUE_LG}>{user?.name || '—'}</p>
            </div>
            <div className={FIELD}>
              <span className={LABEL}>
                <Mail size={13} />
                Email Address
              </span>
              <p className={`${VALUE_LG} [overflow-wrap:anywhere]`}>{user?.email || '—'}</p>
              {pendingEmail && (
                <PendingEmailStrip
                  key={pendingEmail}
                  pendingEmail={pendingEmail}
                  freshlySent={freshlySent}
                  onVerified={handleVerified}
                  onCancelled={handleCancelled}
                  onDropped={handleDropped}
                />
              )}
            </div>
            <div className={FIELD}>
              <span className={LABEL}>
                <Shield size={13} />
                Account Status
              </span>
              <div>{statusBadge}</div>
            </div>
            <div className={FIELD}>
              <span className={LABEL}>
                <Calendar size={13} />
                Member Since
              </span>
              <p className={VALUE_LG}>{formatDate(user?.created_at)}</p>
            </div>
          </div>
          {status === 'pending' && (
            <div className={noticeCls('warn')}>
              <AlertCircle size={15} />
              <span>
                Your account is pending approval. All features unlock once your
                account is activated.
              </span>
            </div>
          )}
        </>
      )}
    </section>
  )
}
