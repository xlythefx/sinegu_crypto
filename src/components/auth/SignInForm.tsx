import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../../services/auth'
import { ApiError } from '../../services/api'
import { postAuthPath } from '../../lib/emailVerification'
import DiscordButton from './DiscordButton'
import PasswordField from './PasswordField'
import { BUTTON, ERROR, INPUT, PILL, SUBTITLE, TITLE } from './authClasses'

interface Props {
  /** Why the previous session ended (`/auth?reason=`), shown until the form has its own message. */
  notice: { text: string; tone: 'muted' | 'error' } | null
  discordEnabled: boolean
}

/** `/auth` — email + password sign-in, with "Continue with Discord" under it. */
export default function SignInForm({ notice, discordEnabled }: Props) {
  const navigate = useNavigate()
  // TEMP: prefilled test account for local testing — remove before launch
  const [email, setEmail] = useState(import.meta.env.DEV ? 'test@sinegu.com' : '')
  const [password, setPassword] = useState(import.meta.env.DEV ? 'password123' : '')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { user } = await login(email, password)
      navigate(postAuthPath(user))
    } catch (err) {
      if (err instanceof ApiError) {
        // Prefer the first field-level validation error when present
        const firstFieldError = err.errors ? Object.values(err.errors)[0]?.[0] : undefined
        setError(
          err.status === 429
            ? 'Too many attempts. Wait a minute and try again.'
            : err.errorCode === 'DISCORD_ONLY'
              ? 'This account signs in with Discord — use the Discord button below.'
              : (firstFieldError ?? err.message),
        )
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h1 className={TITLE}>Sign in</h1>
      <p className={SUBTITLE}>Welcome back. Let your bots get to work.</p>

      <form className="flex flex-col gap-3.5" onSubmit={onSubmit}>
        <input
          type="email"
          placeholder="Email"
          className={INPUT}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <PasswordField
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <Link to="/auth/forgot" className="self-start text-[13px] text-muted hover:text-text">
          Forgot your password?
        </Link>
        {notice && !error && (
          <p className={notice.tone === 'error' ? ERROR : PILL} role="status">
            {notice.text}
          </p>
        )}
        {error && (
          <p className={ERROR} role="alert">
            {error}
          </p>
        )}
        <button type="submit" className={BUTTON} disabled={loading}>
          {loading ? 'Please wait…' : 'Sign In'}
        </button>
      </form>

      {discordEnabled && (
        <DiscordButton
          divider
          label="Continue with Discord"
          onClick={() => navigate('/auth/discord/start?intent=login')}
        />
      )}
    </>
  )
}
