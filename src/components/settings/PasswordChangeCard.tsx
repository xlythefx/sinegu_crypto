import { useState } from 'react'
import { AlertCircle, CheckCircle2, KeyRound } from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import { ApiError, getApiErrorMessage } from '../../services/api'
import { updatePassword } from '../../services/user'

interface PasswordChangeCardProps {
  email: string
}

type Notice = { kind: 'success' | 'error'; text: string } | null

/** Change password — wired to PUT /user/password, confirmed via ConfirmModal. */
export default function PasswordChangeCard({ email }: PasswordChangeCardProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword || !newPassword || !confirmPassword) {
      setNotice({ kind: 'error', text: 'Please complete all password fields.' })
      return
    }
    if (newPassword.length < 8) {
      setNotice({
        kind: 'error',
        text: 'New password must be at least 8 characters long.',
      })
      return
    }
    if (newPassword !== confirmPassword) {
      setNotice({
        kind: 'error',
        text: 'New password and confirmation must be identical.',
      })
      return
    }
    setNotice(null)
    setConfirmOpen(true)
  }

  const handleConfirmedChange = async () => {
    setConfirmOpen(false)
    setSaving(true)
    try {
      const res = await updatePassword(
        currentPassword,
        newPassword,
        confirmPassword,
      )
      setNotice({
        kind: 'success',
        text: res.message || 'Your password has been changed successfully.',
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      if (err instanceof ApiError && err.errorCode === 'INVALID_PASSWORD') {
        setNotice({ kind: 'error', text: 'Your current password is incorrect.' })
      } else {
        setNotice({
          kind: 'error',
          text: getApiErrorMessage(err, 'Unable to update password. Please try again.'),
        })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="dcard set-card spw" data-aos="fade-up">
      <div className="dcard__title-row set-card__head">
        <span className="dchip">
          <KeyRound size={15} />
        </span>
        <div className="set-card__titles">
          <h3 className="dcard__title">Change Password</h3>
          <p className="dcard__sub">Update your account password for better security</p>
        </div>
      </div>

      {notice && (
        <div className={`snotice snotice--${notice.kind}`} role="status">
          {notice.kind === 'success' ? (
            <CheckCircle2 size={15} />
          ) : (
            <AlertCircle size={15} />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      <form className="set-form" onSubmit={handleSubmit}>
        <div className="spw__grid">
          <div className="sfield">
            <label className="sfield__label" htmlFor="pw-current">
              Current Password
            </label>
            <input
              id="pw-current"
              className="sinput"
              type="password"
              autoComplete="current-password"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="sfield">
            <label className="sfield__label" htmlFor="pw-new">
              New Password
            </label>
            <input
              id="pw-new"
              className="sinput"
              type="password"
              autoComplete="new-password"
              placeholder="Enter new password (min. 8)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="sfield">
            <label className="sfield__label" htmlFor="pw-confirm">
              Confirm Password
            </label>
            <input
              id="pw-confirm"
              className="sinput"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>
        <div className="spw__footer">
          <p className="spw__signed">
            Signed in as{' '}
            <span className="spw__signed-email">{email || 'session not found'}</span>
          </p>
          <button type="submit" className="sbtn sbtn--primary" disabled={saving}>
            {saving ? 'Updating…' : 'Change Password'}
          </button>
        </div>
      </form>

      <ConfirmModal
        open={confirmOpen}
        title="Change your password?"
        message="You will need to use the new password the next time you sign in."
        confirmLabel="Yes, change it"
        cancelLabel="No"
        onConfirm={handleConfirmedChange}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  )
}
