import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { register } from '../../../services/auth'
import { VERIFY_EMAIL_PATH } from '../../../lib/emailVerification'
import { REGISTER_STEPS, type WizardStep } from '../../../lib/registerWizard'
import { useSignupWizard } from '../../../hooks/useSignupWizard'
import DiscordButton from '../DiscordButton'
import WizardProgress from './WizardProgress'
import WizardNav from './WizardNav'
import LoginStep from './LoginStep'
import SocialsStep from './SocialsStep'
import SourceStep from './SourceStep'
import { ERROR, INPUT, PILL, STEP_TITLE, SUBTITLE } from '../authClasses'

interface Props {
  /** From an invite link — credited server-side, and pre-ticks "Friend / referral". */
  refCode: string | null
  /** The page swaps its brand panel to match the step. */
  onStepChange?: (step: WizardStep) => void
  /** Show "Sign up with Discord" under the first step. */
  discordEnabled: boolean
}

/**
 * `/auth?mode=register` — the sign-up as four short screens in the owner's
 * order: name → login → Telegram / Discord → how you heard about us + Terms.
 * Answers survive Back; a refusal from the API lands on the step that owns
 * the field (useSignupWizard). Nothing is sent until the last screen.
 */
export default function RegisterWizard({ refCode, onStepChange, discordEnabled }: Props) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const w = useSignupWizard(REGISTER_STEPS, {
    name: '',
    email: '',
    password: '',
    confirm: '',
    telegram: '',
    discord: '',
    heardFrom: refCode ? ['friend'] : [],
    heardOther: '',
    terms: false,
  })
  const v = w.values

  useEffect(() => onStepChange?.(w.step), [w.step, onStepChange])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!w.advance()) return
    setLoading(true)
    try {
      await register(v.name.trim(), v.email.trim(), v.password, v.confirm, refCode ?? undefined, {
        heardFrom: v.heardFrom,
        heardFromOther: v.heardOther,
        telegram: v.telegram,
        discord: v.discord ?? '',
      })
      // Registration mails a six-digit code; the account is unusable until
      // it is redeemed. (A verified answer there bounces on to /dashboard.)
      navigate(VERIFY_EMAIL_PATH)
    } catch (err) {
      w.fail(err)
    } finally {
      setLoading(false)
    }
  }

  const socialsEmpty = !v.telegram.trim() && !(v.discord ?? '').trim()
  const nextLabel = w.isLast
    ? 'Create free account'
    : w.step.key === 'socials' && socialsEmpty
      ? 'Skip for now'
      : 'Continue'

  return (
    <>
      <WizardProgress steps={REGISTER_STEPS} current={w.index} onJump={w.goTo} />

      {/* Re-keyed per step so each screen replays the reveal. */}
      <div key={w.step.key} className="animate-[fadeup_0.35s_ease-out]">
        <h1 className={STEP_TITLE}>{w.step.title}</h1>
        <p className={SUBTITLE}>{w.step.subtitle}</p>

        <form className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
          {w.step.key === 'name' && (
            <>
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
          {w.step.key === 'login' && (
            <LoginStep
              email={v.email}
              password={v.password}
              confirm={v.confirm}
              onEmail={w.set('email')}
              onPassword={w.set('password')}
              onConfirm={w.set('confirm')}
            />
          )}
          {w.step.key === 'socials' && (
            <SocialsStep
              telegram={v.telegram}
              onTelegram={w.set('telegram')}
              discord={v.discord ?? ''}
              onDiscord={w.set('discord')}
            />
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

      {w.index === 0 && discordEnabled && (
        <DiscordButton
          divider
          label="Sign up with Discord"
          onClick={() => navigate('/auth/discord/start?intent=login')}
        />
      )}
    </>
  )
}
