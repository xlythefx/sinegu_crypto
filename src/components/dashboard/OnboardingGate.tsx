import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Hourglass, Link2 } from 'lucide-react'
import InfoModal from '../ui/InfoModal'
import NoticeStrip from '../ui/NoticeStrip'
import { useMe } from '../../hooks/useMe'
import { useSessionUser } from '../../hooks/useSessionUser'
import {
  ackPending,
  hasPendingAck,
  hasSeenConnectPrompt,
  markConnectPromptSeen,
} from '../../lib/onboarding'

const EXCHANGES_PATH = '/dashboard/exchanges'
/** The nudges point straight at the wizard — the list page is one click further. */
const CONNECT_PATH = '/dashboard/exchanges/connect'

/**
 * Onboarding nudges for every /dashboard/* page, driven by the session user:
 *
 * - pending  → dismissible "pending approval" modal (once per browser session)
 *              + persistent caution strip.
 * - active without an exchange account → one-time "you're approved — connect
 *   an exchange" modal + persistent strip and CTA until one is connected.
 * - suspended (stale session; login already blocks) → danger strip only.
 *
 * useMe() refreshes /auth/me on every dashboard mount, so an admin acceptance
 * is picked up without re-login; the session user is the render source so
 * updateStoredUser() calls (wizard connect / disconnect) reflect instantly.
 */
export default function OnboardingGate() {
  useMe()
  const user = useSessionUser()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [pendingOpen, setPendingOpen] = useState(false)
  const [connectOpen, setConnectOpen] = useState(false)

  const uniId = user?.uni_id
  const status = user?.status
  const hasAccount = user?.has_exchange_account
  // Admins/masters skip onboarding entirely.
  const plainUser = !!user && (user.type === undefined || user.type === 'user')

  useEffect(() => {
    if (!uniId || !plainUser) {
      setPendingOpen(false)
      setConnectOpen(false)
      return
    }
    // Statuses are mutually exclusive, so the two modals can never stack; a
    // pending→active flip mid-session closes one and may open the other.
    setPendingOpen(status === 'pending' && !hasPendingAck(uniId))
    setConnectOpen(
      status === 'active' &&
        hasAccount === false &&
        !hasSeenConnectPrompt(uniId),
    )
  }, [uniId, status, hasAccount, plainUser])

  if (!uniId || !plainUser) return null

  const dismissPending = () => {
    ackPending(uniId)
    setPendingOpen(false)
  }

  const dismissConnect = () => {
    markConnectPromptSeen(uniId)
    setConnectOpen(false)
  }

  return (
    <>
      <InfoModal
        open={pendingOpen}
        icon={<Hourglass size={30} />}
        title="You're currently still pending approval"
        message="An admin will review your account shortly. Feel free to look around — trading features unlock once you're approved."
        ctaLabel="Got it"
        onCta={dismissPending}
        onDismiss={dismissPending}
      />
      <InfoModal
        open={connectOpen}
        icon={<Link2 size={30} />}
        title="You're approved — connect an exchange"
        message="Your account is active. Connect an exchange to start receiving trades and tracking real-time PNL."
        ctaLabel="Connect an exchange"
        onCta={() => {
          dismissConnect()
          navigate(CONNECT_PATH)
        }}
        dismissLabel="Maybe later"
        onDismiss={dismissConnect}
      />
      {status === 'pending' && (
        <NoticeStrip
          icon={<Hourglass size={16} />}
          message="Your account is pending approval — features unlock once approved."
        />
      )}
      {status === 'active' && hasAccount === false && (
        <NoticeStrip
          icon={<Link2 size={16} />}
          message="Connect an exchange to start receiving trades."
          cta={
            pathname === EXCHANGES_PATH || pathname === CONNECT_PATH
              ? undefined
              : { label: 'Connect exchange', to: CONNECT_PATH }
          }
        />
      )}
      {status === 'suspended' && (
        <NoticeStrip
          tone="danger"
          message="Your account has been suspended. Please contact support."
        />
      )}
    </>
  )
}
