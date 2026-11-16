import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AtSign } from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import NoticeStrip from '../ui/NoticeStrip'
import { CONTACTS_SETTINGS_PATH } from '../../lib/signupSources'
import { getContactStatus } from '../../services/user'
import type { ContactStatus } from '../../types/signupInfo'

const DISMISS_KEY = 'pa-contacts-reminder-dismissed'

function dismissedThisSession(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

function rememberDismissed(): void {
  try {
    sessionStorage.setItem(DISMISS_KEY, '1')
  } catch {
    /* private mode: it simply asks again next time */
  }
}

/** What is missing, in words. */
function missingWords(missing: ContactStatus['missing']): string {
  if (missing.length === 2) return 'Telegram username and WhatsApp number'
  return missing[0] === 'telegram' ? 'Telegram username' : 'WhatsApp number'
}

/**
 * The dashboard's reminder (owner, 2026-11-16): a customer without a Telegram
 * username and a WhatsApp number cannot connect an exchange. Existing
 * customers signed up before both were required, so they get a pop-up
 * (once per session, like KeyBlockedGate) and a caution strip that stays
 * until both are saved in Settings. An exchange already connected keeps
 * trading — the lock is on connecting only, and the copy says so.
 *
 * The verdict is the API's (`connect_locked`, customers only), so staff never
 * see it. A failed lookup shows nothing: the dashboard must still render.
 */
export default function ContactsGate() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<ContactStatus | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    getContactStatus()
      .then((s) => {
        if (cancelled || !s.connect_locked) return
        setStatus(s)
        if (!dismissedThisSession()) setOpen(true)
      })
      .catch(() => {
        /* the connect page and the API still enforce it */
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!status) return null
  const words = missingWords(status.missing)

  return (
    <>
      <NoticeStrip
        icon={<AtSign size={16} />}
        message={`Add your ${words} in Settings — you need them before you can connect an exchange.`}
        cta={{ label: 'Add now', to: CONTACTS_SETTINGS_PATH }}
      />
      <ConfirmModal
        open={open}
        title={`Add your ${words}`}
        message={`Our team needs a way to reach you about your account. Add your ${words} in Settings — until then you can't connect an exchange. An exchange you've already connected keeps trading as normal.`}
        confirmLabel="Go to Settings"
        cancelLabel="Later"
        onConfirm={() => {
          rememberDismissed()
          setOpen(false)
          navigate(CONTACTS_SETTINGS_PATH)
        }}
        onCancel={() => {
          rememberDismissed()
          setOpen(false)
        }}
      />
    </>
  )
}
