import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Link2, Unlink } from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import { DiscordMark } from '../ui/BrandIcons'
import { getApiErrorMessage } from '../../services/api'
import { getDiscordConfig, unlinkDiscord } from '../../services/discord'
import { useApiData } from '../../hooks/useApiData'
import { saveUser } from '../../lib/session'
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
  HINT,
  notice as noticeCls,
} from './formClasses'
import type { AuthUser } from '../../types/auth'

interface DiscordCardProps {
  user: AuthUser | null
  onUserChange: (user: AuthUser) => void
}

type Notice = { kind: 'success' | 'error'; text: string } | null

/**
 * Settings → Discord: connect the account (the same OAuth flow as the
 * sign-in button, `intent=link`), see what is linked, disconnect it. The
 * link is what puts the user in the Pixel Alpha server and earns the Member /
 * Trader roles, so the card says so.
 *
 * Disconnect is refused while the account has no password — Discord would
 * be its only way in. Hidden entirely while the OAuth app is not configured.
 */
export default function DiscordCard({ user, onUserChange }: DiscordCardProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const config = useApiData(getDiscordConfig)
  const [notice, setNotice] = useState<Notice>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  // The callback page lands here with a flag after a successful link.
  useEffect(() => {
    const state = location.state as { discordLinked?: boolean } | null
    if (state?.discordLinked) {
      setNotice({ kind: 'success', text: 'Discord connected. Your server roles will follow your account.' })
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location, navigate])

  if (!config.data?.configured) return null

  const linked = user?.discord ?? null
  const canUnlink = user?.has_password !== false

  const disconnect = async () => {
    setConfirmOpen(false)
    setBusy(true)
    setNotice(null)
    try {
      const res = await unlinkDiscord()
      saveUser(res.user)
      onUserChange(res.user)
      setNotice({ kind: 'success', text: 'Discord disconnected.' })
    } catch (err) {
      setNotice({ kind: 'error', text: getApiErrorMessage(err, 'Could not disconnect Discord.') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={`${CARD} flex flex-col mb-4`} data-aos="fade-up">
      <div className={CARD_HEAD}>
        <span className={CHIP}>
          <DiscordMark size={15} />
        </span>
        <div className={CARD_TITLES}>
          <h3 className={CARD_TITLE}>Discord</h3>
          <p className={CARD_SUB}>
            {linked
              ? 'Sign in with Discord and keep your server roles in step with your account'
              : 'Connect Discord to sign in with one click and get your roles in the Pixel Alpha server'}
          </p>
        </div>
        {linked ? (
          <button
            type="button"
            className={BTN_GHOST_SM}
            onClick={() => setConfirmOpen(true)}
            disabled={busy || !canUnlink}
            title={canUnlink ? undefined : 'Set a password first'}
          >
            <Unlink size={13} />
            {busy ? 'Working…' : 'Disconnect'}
          </button>
        ) : (
          <button
            type="button"
            className={BTN_PRIMARY_SM}
            onClick={() => navigate('/auth/discord/start?intent=link&returnTo=/dashboard/settings')}
          >
            <Link2 size={13} />
            Connect Discord
          </button>
        )}
      </div>

      {notice && (
        <div className={noticeCls(notice.kind)} role="status">
          {notice.kind === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{notice.text}</span>
        </div>
      )}

      {linked ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted">
          <span>
            Connected as{' '}
            <span className="font-mono font-bold text-text [overflow-wrap:anywhere]">@{linked.username}</span>
          </span>
          {linked.linked_at && <span>since {formatDate(linked.linked_at)}</span>}
        </div>
      ) : (
        <p className="text-[12.5px] text-muted">
          You'll be asked to authorise Pixel Alpha on Discord, then brought straight back here.
        </p>
      )}
      {linked && !canUnlink && (
        <p className={`${HINT} mt-2`}>
          Discord is currently the only way into this account — set a password below before disconnecting it.
        </p>
      )}

      <ConfirmModal
        open={confirmOpen}
        title="Disconnect Discord?"
        message="You'll sign in with your password from now on, and your Member / Trader roles in the Pixel Alpha server will be removed."
        confirmLabel="Yes, disconnect"
        cancelLabel="No"
        danger
        onConfirm={() => void disconnect()}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  )
}
