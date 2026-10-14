import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import AuthFrame, { AuthBrand } from '../components/auth/AuthFrame'
import {
  BUTTON_GHOST,
  ERROR,
  ICON_CHIP,
  INPUT,
  PILL,
  STEP_TITLE,
  SUBTITLE,
  TITLE,
} from '../components/auth/authClasses'
import { DiscordMark } from '../components/ui/BrandIcons'
import WizardProgress from '../components/auth/wizard/WizardProgress'
import WizardNav from '../components/auth/wizard/WizardNav'
import SocialsStep from '../components/auth/wizard/SocialsStep'
import SourceStep from '../components/auth/wizard/SourceStep'
import { forgetReferralCode, recallReferralCode } from '../lib/referral'
import { isLoggedIn } from '../lib/session'
import { postAuthPath } from '../lib/emailVerification'
import { DISCORD_SIGNUP_STEPS } from '../lib/registerWizard'
import { useSignupWizard } from '../hooks/useSignupWizard'
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
 * `/auth/discord/terms` — between "Discord says who you are" and "you have an
 * account": the register wizard's screens minus the login Discord already
 * answered — name (Discord's suggestion, editable) → Telegram (optional) →
 * how you heard about us + the Terms. The account row does not exist until
 * the last screen is accepted; the API holds the profile for 15 minutes.
 */
export default function DiscordTerms() {
  const location = useLocation()
  const navigate = useNavigate()
  const [pending] = useState(() => readPending(location.state))
  const [loading, setLoading] = useState(false)
  const refCode = recallReferralCode()
  const w = useSignupWizard(DISCORD_SIGNUP_STEPS, {
    name: pending?.profile.name ?? '',
    // Discord proved the email; there is no login step here.
    email: '',
    password: '',
    confirm: '',
    telegram: '',
    discord: null,
    // An invite link means a friend sent them — pre-ticked; they can untick it.
    heardFrom: refCode ? ['friend'] : [],
    heardOther: '',
    terms: false,
  })
  const v = w.values

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
    if (!w.advance()) return
    setLoading(true)
    try {
      const { user } = await completeDiscordSignup(signupToken, v.name.trim() || null, refCode, {
        heardFrom: v.heardFrom,
        heardFromOther: v.heardOther,
        telegram: v.telegram,
      })
      try {
        sessionStorage.removeItem(DISCORD_SIGNUP_KEY)
      } catch {
        // nothing to clear
      }
      forgetReferralCode()
      // Discord vouched for the address → straight in; otherwise a code was mailed.
      navigate(postAuthPath(user), { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.errorCode === 'SIGNUP_EXPIRED') {
        w.setError('That took too long — please start again with Discord.')
      } else {
        w.fail(err)
      }
    } finally {
      setLoading(false)
    }
  }

  const nextLabel = w.isLast
    ? 'Create my account'
    : w.step.key === 'socials' && !v.telegram.trim()
      ? 'Skip for now'
      : 'Continue'

  return (
    <AuthFrame back={{ to: '/auth', label: '← Sign in' }}>
      <AuthBrand />
      <WizardProgress steps={DISCORD_SIGNUP_STEPS} current={w.index} onJump={w.goTo} />

      {/* Re-keyed per step so each screen replays the reveal. */}
      <div key={w.step.key} className="animate-[fadeup_0.35s_ease-out]">
        <h1 className={STEP_TITLE}>{w.step.title}</h1>
        <p className={SUBTITLE}>{w.step.subtitle}</p>

        <form className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
          {w.step.key === 'name' && (
            <>
              <div className="flex items-center gap-3 rounded-[12px] border border-border bg-surface2 p-3">
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
              <input
                type="text"
                placeholder="Full name"
                className={INPUT}
                value={v.name}
                onChange={(e) => w.set('name')(e.target.value)}
                autoComplete="name"
                maxLength={255}
                autoFocus
              />
              {refCode && (
                <p className={PILL}>
                  Referral code applied:{' '}
                  <span className="font-bold tracking-[0.08em]">{refCode}</span>
                </p>
              )}
            </>
          )}
          {w.step.key === 'socials' && (
            <SocialsStep telegram={v.telegram} onTelegram={w.set('telegram')} />
          )}
          {w.step.key === 'source' && (
            <SourceStep
              heardFrom={v.heardFrom}
              onHeardFrom={w.set('heardFrom')}
              heardOther={v.heardOther}
              onHeardOther={w.set('heardOther')}
              terms={v.terms}
              onTerms={w.set('terms')}
            />
          )}

          {w.error && (
            <p className={ERROR} role="alert">
              {w.error}
            </p>
          )}

          <WizardNav
            onBack={w.index > 0 ? () => w.goTo(w.index - 1) : undefined}
            nextLabel={nextLabel}
            busy={loading}
            final={w.isLast}
          />
        </form>
      </div>
    </AuthFrame>
  )
}
