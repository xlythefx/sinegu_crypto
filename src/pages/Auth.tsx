import { useEffect, useState, type MouseEvent } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { getDiscordConfig } from '../services/discord'
import { isLoggedIn } from '../lib/session'
import { normaliseReferralCode, recallReferralCode, rememberReferralCode } from '../lib/referral'
import { REGISTER_STEPS, type WizardStep } from '../lib/registerWizard'
import { useApiData } from '../hooks/useApiData'
import AuthFrame, { AuthBrand } from '../components/auth/AuthFrame'
import AuthBrandPanel from '../components/auth/AuthBrandPanel'
import SignInForm from '../components/auth/SignInForm'
import RegisterWizard from '../components/auth/wizard/RegisterWizard'

type Mode = 'signin' | 'register'

/**
 * Why the previous session ended, when the API client sent us here with
 * `?reason=` (services/api.ts endSession): the token expired, or the account
 * was suspended. Anything else is not ours to explain.
 */
function sessionEndedNotice(
  reason: string | null,
): { text: string; tone: 'muted' | 'error' } | null {
  if (reason === 'expired') {
    return { text: 'Your session has expired. Please sign in again.', tone: 'muted' }
  }
  if (reason === 'suspended') {
    return {
      text: 'This account has been suspended. Contact support if you think this is a mistake.',
      tone: 'error',
    }
  }
  return null
}

const SIGNIN_PANEL = {
  kicker: 'WELCOME BACK',
  title: 'Your edge, on autopilot.',
  body: 'Pick up right where your strategies left off. Funds never leave your exchange, and you keep 80% of every win.',
}

export default function Auth() {
  // Already signed in (token in localStorage) — skip the form entirely
  if (isLoggedIn()) {
    return <Navigate to="/dashboard" replace />
  }

  return <AuthForm />
}

function AuthForm() {
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
  // The register wizard's current step decides the brand panel's words.
  const [registerStep, setRegisterStep] = useState<WizardStep>(REGISTER_STEPS[0])
  // Read once on mount; shown until the form produces its own message.
  const [sessionNotice] = useState(() => sessionEndedNotice(searchParams.get('reason')))

  // Whether the Discord button is shown. Any failure reads as "off", so an
  // older API or a network blip just leaves the classic form.
  const discord = useApiData(getDiscordConfig)
  const discordEnabled = discord.data?.enabled === true

  const isRegister = mode === 'register'

  const switchMode = () => {
    const next: Mode = isRegister ? 'signin' : 'register'
    setMode(next)
    setRegisterStep(REGISTER_STEPS[0])
    // Keep the URL saying which form is open, so a refresh (or a link someone
    // copies mid-signup) comes back to the same one. `replace` so flipping
    // between the two does not fill the back button with dead steps; any
    // ?ref= already on the URL is preserved.
    const params = new URLSearchParams(searchParams)
    params.set('mode', next)
    setSearchParams(params, { replace: true })
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

          {isRegister ? (
            <RegisterWizard
              refCode={refCode}
              onStepChange={setRegisterStep}
              discordEnabled={discordEnabled}
            />
          ) : (
            <SignInForm notice={sessionNotice} discordEnabled={discordEnabled} />
          )}

          <p className="mt-[22px] text-center text-[13.5px] text-muted">
            {isRegister ? 'Already trading with us?' : "Don't have an account?"}{' '}
            <a
              href="#"
              className="font-bold"
              onClick={(e) => {
                e.preventDefault()
                switchMode()
              }}
            >
              {isRegister ? 'Sign in' : 'Create one free'}
            </a>
          </p>
        </div>
      </div>

      {/* RIGHT: brand panel — follows the wizard's step */}
      <AuthBrandPanel {...(isRegister ? registerStep.panel : SIGNIN_PANEL)} />
    </AuthFrame>
  )
}
