import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import AuthFrame, { AuthBrand } from '../components/auth/AuthFrame'
import { BUTTON_GHOST, ERROR, ICON_CHIP, SUBTITLE, TITLE } from '../components/auth/authClasses'
import { DiscordMark } from '../components/ui/BrandIcons'
import { beginDiscordFlow, safeReturnTo } from '../lib/discordOAuth'
import { isLoggedIn } from '../lib/session'
import { discordRedirectUri, getDiscordConfig } from '../services/discord'

/**
 * `/auth/discord/start?intent=login|link&returnTo=/path`
 *
 * Mints the nonce and sends the browser to Discord. Reachable by URL on
 * purpose: while DISCORD_LOGIN_PUBLIC is off the button is hidden from /auth,
 * and this is how a developer rehearses the flow on prod. No `isLoggedIn()`
 * redirect — the `link` intent arrives signed in.
 */
export default function DiscordStart() {
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  const intent = params.get('intent') === 'link' ? 'link' : 'login'
  const returnTo = safeReturnTo(params.get('returnTo'), intent === 'link' ? '/dashboard/settings' : '/dashboard')

  useEffect(() => {
    // StrictMode mounts twice in dev; one flow, one nonce.
    if (started.current) return
    started.current = true

    if (intent === 'link' && !isLoggedIn()) {
      setError('Sign in first, then connect Discord from Settings.')
      return
    }

    void getDiscordConfig().then((config) => {
      if (!config.configured || !config.authorize_url) {
        setError('Discord sign-in is not available yet.')
        return
      }
      window.location.assign(
        beginDiscordFlow(config.authorize_url, intent, returnTo, discordRedirectUri()),
      )
    })
  }, [intent, returnTo])

  return (
    <AuthFrame back={{ to: intent === 'link' ? returnTo : '/auth', label: intent === 'link' ? '← Settings' : '← Sign in' }}>
      <AuthBrand />
      <span className={ICON_CHIP}>
        <DiscordMark size={20} />
      </span>
      <h1 className={`${TITLE} mt-4`}>{intent === 'link' ? 'Connecting Discord' : 'Continue with Discord'}</h1>
      {error ? (
        <>
          <p className={ERROR} role="alert">
            <AlertCircle size={14} className="mr-1.5 inline-block align-[-2px]" />
            {error}
          </p>
          <Link to={intent === 'link' ? returnTo : '/auth'} className={`${BUTTON_GHOST} mt-4`}>
            {intent === 'link' ? 'Back to Settings' : 'Back to sign in'}
          </Link>
        </>
      ) : (
        <p className={`${SUBTITLE} animate-[pulse_1.6s_ease-in-out_infinite]`}>
          Taking you to Discord…
        </p>
      )}
    </AuthFrame>
  )
}
