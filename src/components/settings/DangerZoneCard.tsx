import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import { logout } from '../../services/auth'

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
    <section className="dcard set-card sdz" data-aos="fade-up">
      <div className="set-card__head">
        <div className="set-card__titles">
          <h3 className="dcard__title sdz__title">Danger Zone</h3>
          <p className="dcard__sub">Irreversible actions</p>
        </div>
      </div>
      <div className="sdz__row">
        <div>
          <p className="sdz__action">Sign out of Trader Portal</p>
          <p className="sdz__hint">End your current session on this device</p>
        </div>
        <button
          type="button"
          className="sbtn sbtn--danger"
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
