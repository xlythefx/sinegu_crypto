import { useState } from 'react'
import { CheckCircle2, KeyRound } from 'lucide-react'
import PasswordChangeDialog from './PasswordChangeDialog'
import {
  BTN_PRIMARY_SM,
  CARD,
  CARD_HEAD,
  CARD_SUB,
  CARD_TITLE,
  CARD_TITLES,
  CHIP,
  notice as noticeCls,
} from './formClasses'

interface PasswordChangeCardProps {
  email: string
  /**
   * `set` for a Discord-only account (has_password === false): the card
   * offers a first password instead of a change, because there is no current
   * one to ask for — and until one exists Discord cannot be disconnected.
   */
  mode?: 'change' | 'set'
  /** Fired after a `set` succeeds so the page can refresh the user. */
  onChanged?: () => void
}

/** Change (or first set) the password — opens PasswordChangeDialog. */
export default function PasswordChangeCard({
  email,
  mode = 'change',
  onChanged,
}: PasswordChangeCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const isSet = mode === 'set'

  return (
    <section className={`${CARD} flex flex-col mb-4`} data-aos="fade-up">
      <div className={CARD_HEAD}>
        <span className={CHIP}>
          <KeyRound size={15} />
        </span>
        <div className={CARD_TITLES}>
          <h3 className={CARD_TITLE}>{isSet ? 'Set a Password' : 'Change Password'}</h3>
          <p className={CARD_SUB}>
            {isSet
              ? 'You sign in with Discord. A password adds a second way in.'
              : 'Update your account password for better security'}
          </p>
        </div>
        <button
          type="button"
          className={BTN_PRIMARY_SM}
          onClick={() => {
            setSuccess(null)
            setDialogOpen(true)
          }}
        >
          <KeyRound size={13} />
          {isSet ? 'Set Password' : 'Change Password'}
        </button>
      </div>

      {success && (
        <div className={noticeCls('success')} role="status">
          <CheckCircle2 size={15} />
          <span>{success}</span>
        </div>
      )}

      <p className="text-[12.5px] text-muted">
        Signed in as{' '}
        <span className="text-text font-bold [overflow-wrap:anywhere]">
          {email || 'session not found'}
        </span>
      </p>

      <PasswordChangeDialog
        open={dialogOpen}
        email={email}
        mode={mode}
        onClose={() => setDialogOpen(false)}
        onSuccess={(message) => {
          setDialogOpen(false)
          setSuccess(message)
          onChanged?.()
        }}
      />
    </section>
  )
}
