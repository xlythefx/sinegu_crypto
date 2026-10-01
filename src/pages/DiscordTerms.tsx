import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { FileCheck2 } from 'lucide-react'
import AuthFrame, { AuthBrand } from '../components/auth/AuthFrame'
import {
  BUTTON,
  BUTTON_GHOST,
  CHECKBOX,
  CHECKBOX_LABEL,
  ERROR,
  ICON_CHIP,
  INPUT,
  LINK,
  PILL,
  SUBTITLE,
  TITLE,
} from '../components/auth/authClasses'
import { DiscordMark } from '../components/ui/BrandIcons'
import { forgetReferralCode, recallReferralCode } from '../lib/referral'
import { isLoggedIn } from '../lib/session'
import { postAuthPath } from '../lib/emailVerification'
import { ApiError } from '../services/api'
import { completeDiscordSignup } from '../services/discord'
import { DISCORD_SIGNUP_KEY } from './DiscordCallback'
import type { DiscordProfile } from '../types/discord'

interface PendingSignup {
  signupToken: string
  profile: DiscordProfile
}

function readPending(state: unknown): PendingSignup | null {
  const fromState = state as Partial<PendingSignup> | null
  if (fromState?.signupToken && fromState.profile) {
    return { signupToken: fromState.signupToken, profile: fromState.profile }
  }
  try {
    const raw = sessionStorage.getItem(DISCORD_SIGNUP_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PendingSignup>
    return parsed.signupToken && parsed.profile
      ? { signupToken: parsed.signupToken, profile: parsed.profile }
      : null
  } catch {
    return null
  }
}

/**
 * `/auth/discord/terms` — the one step between "Discord says who you are"
 * and "you have an account": the Terms, exactly as the register form asks
 * for them, plus the name Discord suggested (editable). The account row does
 * not exist until this is accepted; the API holds the profile for 15 minutes.
 */
export default function DiscordTerms() {
  const location = useLocation()
  const navigate = useNavigate()
  const [pending] = useState(() => readPending(location.state))
  const [name, setName] = useState(pending?.profile.name ?? '')
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const refCode = recallReferralCode()

  // Already signed in (this or another tab finished) — nothing left to accept.
  if (isLoggedIn()) return <Navigate to="/dashboard" replace />

  if (!pending) {
    return (
      <AuthFrame back={{ to: '/auth', label: '← Sign in' }}>
        <AuthBrand />
        <span className={ICON_CHIP}>
          <DiscordMark size={20} />
        </span>
        <h1 className={`${TITLE} mt-4`}>Nothing to finish</h1>
        <p className={SUBTITLE}>
          This page follows a Discord sign-in, and there isn't one waiting. Start
          again from the sign-in page.
        </p>
        <Link to="/auth" className={BUTTON_GHOST}>
          Back to sign in
        </Link>
      </AuthFrame>
    )
  }

  const { signupToken, profile } = pending

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!accepted) {
      setError('Please accept the Terms to create your account.')
      return
    }
    setLoading(true)
    try {
      const { user } = await completeDiscordSignup(signupToken, name.trim() || null, refCode)
      try {
        sessionStorage.removeItem(DISCORD_SIGNUP_KEY)
      } catch {
        // nothing to clear
      }
      forgetReferralCode()
      // Discord vouched for the address → straight in; otherwise a code was mailed.
      navigate(postAuthPath(user), { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.errorCode === 'SIGNUP_EXPIRED') {
          setError('That took too long — please start again with Discord.')
        } else if (err.status === 429) {
          setError('Too many attempts. Wait a minute and try again.')
        } else {
          const firstFieldError = err.errors ? Object.values(err.errors)[0]?.[0] : undefined
          setError(firstFieldError ?? err.message)
        }
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthFrame back={{ to: '/auth', label: '← Sign in' }}>
      <AuthBrand />
      <span className={ICON_CHIP}>
        <FileCheck2 size={20} />
      </span>
      <h1 className={`${TITLE} mt-4`}>One last step</h1>
      <p className={SUBTITLE}>
        Discord confirmed who you are. Check your name, accept the Terms, and your
        account is ready — it goes into the approval queue like every new one.
      </p>

      <div className="mb-5 flex items-center gap-3 rounded-[12px] border border-border bg-surface2 p-3">
        <img
          src={profile.avatar_url}
          alt=""
          className="h-10 w-10 shrink-0 rounded-full bg-surface object-cover"
        />
        <div className="min-w-0">
          <p className="truncate font-mono text-[12px] text-muted">@{profile.username}</p>
          <p className="truncate text-[13px] [overflow-wrap:anywhere]">{profile.email}</p>
        </div>
        <span className="ml-auto text-[#5865F2]">
          <DiscordMark size={18} />
        </span>
      </div>

      <form className="flex flex-col gap-3.5" onSubmit={submit}>
        <input
          type="text"
          placeholder="Full name"
          className={INPUT}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={255}
          required
        />
        <label className={CHECKBOX_LABEL}>
          <input
            type="checkbox"
            className={CHECKBOX}
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
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
        {error && (
          <p className={ERROR} role="alert">
            {error}
          </p>
        )}
        {refCode && (
          <p className={PILL}>
            Referral code applied: <span className="font-bold tracking-[0.08em]">{refCode}</span>
          </p>
        )}
        <button type="submit" className={BUTTON} disabled={loading}>
          {loading ? 'Please wait…' : 'Create my account'}
        </button>
      </form>
    </AuthFrame>
  )
}
