import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import { logout } from '../../services/auth'
import {
  BTN_DANGER,
  CARD,
  CARD_SUB,
  CARD_TITLE,
  CARD_TITLES,
} from './formClasses'

/** Sign out of the trader portal — confirmed via ConfirmModal, wired to /auth/logout. */
export default function DangerZoneCard() {
  const navigate = useNavigate()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setConfirmOpen(false)
    setSigningOut(true)
    try {
      await logout()
    } catch {
      // Session is cleared locally even if the API call fails.
    } finally {
      navigate('/auth')
    }
  }

  return (
    <section
      className={`${CARD} flex flex-col mb-4 border-l-[3px] border-l-red`}
      data-aos="fade-up"
    >
      <div>
        <div className={CARD_TITLES}>
          <h3 className={`${CARD_TITLE} text-red`}>Danger Zone</h3>
          <p className={CARD_SUB}>Irreversible actions</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap mt-1">
        <div>
          <p className="text-[13.5px] font-bold">Sign out of Trader Portal</p>
          <p className="text-[12px] text-muted mt-0.5">
            End your current session on this device
          </p>
        </div>
        <button
          type="button"
          className={BTN_DANGER}
          onClick={() => setConfirmOpen(true)}
          disabled={signingOut}
        >
          <LogOut size={14} />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Sign out?"
        message="You will be signed out of your trader portal on this device."
        confirmLabel="Yes, sign out"
        cancelLabel="No"
        danger
        onConfirm={handleSignOut}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  )
}
