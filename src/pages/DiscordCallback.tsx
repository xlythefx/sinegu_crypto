import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, KeyRound, ShieldAlert } from 'lucide-react'
import AuthFrame, { AuthBrand } from '../components/auth/AuthFrame'
import DiscordButton from '../components/auth/DiscordButton'
import {
  BUTTON,
  BUTTON_GHOST,
  ERROR,
  ICON_CHIP,
  INPUT,
  SUBTITLE,
  TITLE,
} from '../components/auth/authClasses'
import { DiscordMark } from '../components/ui/BrandIcons'
import { consumeDiscordFlow } from '../lib/discordOAuth'
import { isLoggedIn, saveUser } from '../lib/session'
import { ApiError } from '../services/api'
import {
  exchangeDiscordCode,
  linkDiscord,
  linkDiscordWithPassword,
} from '../services/discord'
import type { DiscordProfile } from '../types/discord'

/** Hand-off to the Terms page (same tab from here on, so sessionStorage is right). */
export const DISCORD_SIGNUP_KEY = 'pa:discord-signup'

type Phase =
  | { kind: 'exchanging' }
  | { kind: 'password'; linkToken: string; profile: DiscordProfile }
  | { kind: 'mismatch' }
  | { kind: 'denied' }
  | { kind: 'error'; message: string }

/**
 * `/auth/discord/callback?code&state` — where Discord sends the browser back.
 *
 * The query is stripped from the URL before anything else (a reload or a
 * referrer must not replay the single-use code), the pending flow record is
 * consumed, and only a `state` this browser minted is accepted. A missing or
 * foreign record is NOT a dead end: the page says it could not confirm the
 * sign-in started here and offers to start again — which is what happens
 * when a phone opened Discord in an in-app browser.
 */
export default function DiscordCallback() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>({ kind: 'exchanging' })
  const started = useRef(false)

  useEffect(() => {
    // StrictMode runs effects twice in dev; the code is single-use.
    if (started.current) return
    started.current = true

    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const discordError = url.searchParams.get('error')
    window.history.replaceState(null, '', url.pathname)

    if (discordError) {
      setPhase({ kind: 'denied' })
      return
    }

    const flow = consumeDiscordFlow(state)
    if (!flow || !code) {
      setPhase({ kind: 'mismatch' })
      return
    }

    const fail = (err: unknown) => {
      if (err instanceof ApiError) {
        setPhase({
          kind: 'error',
          message:
            err.status === 429
              ? 'Too many attempts. Wait a minute and try again.'
              : err.message || 'Discord sign-in failed. Please try again.',
        })
      } else {
        setPhase({ kind: 'error', message: 'Something went wrong. Please try again.' })
      }
    }

    if (flow.intent === 'link') {
      if (!isLoggedIn()) {
        setPhase({ kind: 'error', message: 'Sign in first, then connect Discord from Settings.' })
        return
      }
      linkDiscord(code)
        .then((res) => {
          saveUser(res.user)
          navigate(flow.returnTo, { replace: true, state: { discordLinked: true } })
        })
        .catch(fail)
      return
    }

    exchangeDiscordCode(code)
      .then((res) => {
        if (res.status === 'logged_in') {
          navigate('/dashboard', { replace: true })
        } else if (res.status === 'password_required') {
          setPhase({ kind: 'password', linkToken: res.link_token, profile: res.profile })
        } else {
          try {
            sessionStorage.setItem(
              DISCORD_SIGNUP_KEY,
              JSON.stringify({ signupToken: res.signup_token, profile: res.profile }),
            )
          } catch {
            // Falls through to the Terms page's own "start again" state.
          }
          navigate('/auth/discord/terms', { replace: true, state: { signupToken: res.signup_token, profile: res.profile } })
        }
      })
      .catch(fail)
  }, [navigate])

  const restartTo = isLoggedIn()
    ? '/auth/discord/start?intent=link&returnTo=/dashboard/settings'
    : '/auth/discord/start?intent=login'

  return (
    <AuthFrame back={{ to: isLoggedIn() ? '/dashboard/settings' : '/auth', label: isLoggedIn() ? '← Settings' : '← Sign in' }}>
      <AuthBrand />

      {phase.kind === 'exchanging' && (
        <>
          <span className={ICON_CHIP}>
            <DiscordMark size={20} />
          </span>
          <h1 className={`${TITLE} mt-4`}>Signing you in</h1>
          <p className={`${SUBTITLE} animate-[pulse_1.6s_ease-in-out_infinite]`}>
            Confirming with Discord…
          </p>
        </>
      )}

      {phase.kind === 'password' && (
        <PasswordStep
          linkToken={phase.linkToken}
          profile={phase.profile}
          onDone={() => navigate('/dashboard', { replace: true })}
          onExpired={() => setPhase({ kind: 'mismatch' })}
          onRefused={(message) => setPhase({ kind: 'error', message })}
        />
      )}

      {phase.kind === 'mismatch' && (
        <>
          <span className={ICON_CHIP}>
            <ShieldAlert size={20} />
          </span>
          <h1 className={`${TITLE} mt-4`}>Let's try that again</h1>
          <p className={SUBTITLE}>
            We couldn't confirm this sign-in started in this browser — that happens
            when Discord opened in another app, or the page took too long. Nothing
            was changed. Start again from here and it will go through.
          </p>
          <DiscordButton
            label="Continue with Discord"
            onClick={() => navigate(restartTo, { replace: true })}
          />
          <Link to={isLoggedIn() ? '/dashboard/settings' : '/auth'} className={`${BUTTON_GHOST} mt-3`}>
            {isLoggedIn() ? 'Back to Settings' : 'Back to sign in'}
          </Link>
        </>
      )}

      {phase.kind === 'denied' && (
        <>
          <span className={ICON_CHIP}>
            <DiscordMark size={20} />
          </span>
          <h1 className={`${TITLE} mt-4`}>Sign-in cancelled</h1>
          <p className={SUBTITLE}>
            You didn't authorise Pixel Alpha on Discord, so nothing was connected.
          </p>
          <DiscordButton label="Try again" onClick={() => navigate(restartTo, { replace: true })} />
          <Link to="/auth" className={`${BUTTON_GHOST} mt-3`}>
            Back to sign in
          </Link>
        </>
      )}

      {phase.kind === 'error' && (
        <>
          <span className={ICON_CHIP}>
            <AlertCircle size={20} />
          </span>
          <h1 className={`${TITLE} mt-4`}>Discord sign-in failed</h1>
          <p className={ERROR} role="alert">
            {phase.message}
          </p>
          <Link to={isLoggedIn() ? '/dashboard/settings' : '/auth'} className={`${BUTTON_GHOST} mt-4`}>
            {isLoggedIn() ? 'Back to Settings' : 'Back to sign in'}
          </Link>
        </>
      )}
    </AuthFrame>
  )
}

/**
 * The existing-email step: the account's own password is what proves the
 * person pressing "Continue with Discord" owns it. Wrong guesses are capped
 * per token on the API; the count comes back on each refusal.
 */
function PasswordStep({
  linkToken,
  profile,
  onDone,
  onExpired,
  onRefused,
}: {
  linkToken: string
  profile: DiscordProfile
  onDone: () => void
  onExpired: () => void
  onRefused: (message: string) => void
}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await linkDiscordWithPassword(linkToken, password)
      onDone()
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.errorCode === 'INVALID_PASSWORD') {
          const left = (err.payload as { attempts_left?: number } | undefined)?.attempts_left
          setError(
            left === 0
              ? 'Too many wrong passwords — start again with Discord.'
              : `Incorrect password.${typeof left === 'number' ? ` ${left} ${left === 1 ? 'try' : 'tries'} left.` : ''}`,
          )
          if (left === 0) onExpired()
        } else if (err.errorCode === 'LINK_EXPIRED') {
          onExpired()
        } else if (err.status === 429) {
          setError('Too many attempts. Wait a minute and try again.')
        } else {
          onRefused(err.message || 'Could not connect Discord to this account.')
        }
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <span className={ICON_CHIP}>
        <KeyRound size={20} />
      </span>
      <h1 className={`${TITLE} mt-4`}>This email has an account</h1>
      <p className={SUBTITLE}>
        <span className="font-semibold text-text [overflow-wrap:anywhere]">{profile.email}</span>{' '}
        is already registered. Enter that account's password once to connect it
        to your Discord — after that, Discord alone signs you in.
      </p>

      <div className="mb-5 flex items-center gap-3 rounded-[12px] border border-border bg-surface2 p-3">
        <img
          src={profile.avatar_url}
          alt=""
          className="h-10 w-10 shrink-0 rounded-full bg-surface object-cover"
        />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-bold">{profile.name}</p>
          <p className="truncate font-mono text-[12px] text-muted">@{profile.username}</p>
        </div>
        <span className="ml-auto text-[#5865F2]">
          <DiscordMark size={18} />
        </span>
      </div>

      <form className="flex flex-col gap-3.5" onSubmit={submit}>
        <input
          type="password"
          placeholder="Account password"
          autoComplete="current-password"
          className={INPUT}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
        />
        {error && (
          <p className={ERROR} role="alert">
            {error}
          </p>
        )}
        <button type="submit" className={BUTTON} disabled={loading}>
          {loading ? 'Please wait…' : 'Connect and sign in'}
        </button>
      </form>
      <p className="mt-5 text-center text-[13px] text-muted">
        Forgot it?{' '}
        <Link to="/auth/forgot" className="font-bold text-text">
          Reset your password
        </Link>
      </p>
    </>
  )
}
