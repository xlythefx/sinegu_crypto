import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, KeyRound, X } from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import { ApiError, getApiErrorMessage } from '../../services/api'
import { setPassword, updatePassword } from '../../services/user'
import { saveUser } from '../../lib/session'
import {
  BTN_GHOST,
  BTN_PRIMARY,
  CARD_SUB,
  CARD_TITLE,
  CHIP,
  FIELD,
  FORM,
  ICON_BTN,
  INPUT,
  LABEL,
  notice as noticeCls,
} from './formClasses'

interface PasswordChangeDialogProps {
  open: boolean
  /** Shown as the "signed in as" hint in the footer. */
  email: string
  /**
   * `change` (default) asks for the current password and PUTs /user/password.
   * `set` is for a Discord-only account that has none yet: no current
   * password field, POST /user/password/set, and the session user is
   * refreshed so Settings flips to the change card.
   */
  mode?: 'change' | 'set'
  onClose: () => void
  /** Called after the API succeeds — the parent closes + reports. */
  onSuccess: (message: string) => void
}

/**
 * Change (or first set) a password in a modal — validates locally, confirms
 * through ConfirmModal, then calls the API (which also revokes other sessions).
 */
export default function PasswordChangeDialog({
  open,
  email,
  mode = 'change',
  onClose,
  onSuccess,
}: PasswordChangeDialogProps) {
  const isSet = mode === 'set'
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fresh, empty fields every time the dialog opens.
  useEffect(() => {
    if (!open) return
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setConfirmOpen(false)
    setSaving(false)
    setError(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      // While confirming or saving, Escape belongs to the confirm step only.
      if (e.key === 'Escape' && !confirmOpen && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, confirmOpen, saving, onClose])

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    if ((!isSet && !currentPassword) || !newPassword || !confirmPassword) {
      setError('Please complete all password fields.')
      return
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation must be identical.')
      return
    }
    setError(null)
    setConfirmOpen(true)
  }

  const handleConfirmedChange = async () => {
    setConfirmOpen(false)
    setSaving(true)
    try {
      if (isSet) {
        const res = await setPassword(newPassword, confirmPassword)
        saveUser(res.user)
        onSuccess(res.message || 'Your password is set. You can now sign in with it too.')
      } else {
        const res = await updatePassword(currentPassword, newPassword, confirmPassword)
        onSuccess(res.message || 'Your password has been changed successfully.')
      }
    } catch (err) {
      if (err instanceof ApiError && err.errorCode === 'INVALID_PASSWORD') {
        setError('Your current password is incorrect.')
      } else {
        setError(
          getApiErrorMessage(err, 'Unable to update password. Please try again.'),
        )
      }
    } finally {
      setSaving(false)
    }
  }

  // Portal to <body> so the overlay covers the page — the card's AOS transform
  // would otherwise become the containing block and trap position:fixed.
  return createPortal(
    <div
      className="fixed inset-0 bg-[rgba(0,0,0,0.55)] backdrop-blur-[3px] flex items-center justify-center p-6 z-[1000] animate-[fadeup_0.2s_ease_both] max-[600px]:p-4"
      onClick={() => !saving && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={isSet ? 'Set a password' : 'Change password'}
    >
      <div
        className="w-full max-w-[460px] max-h-[calc(100vh-48px)] overflow-y-auto p-[26px] border border-border rounded-[20px] bg-surface shadow-[0_30px_80px_rgba(0,0,0,0.35)] animate-[fadeup_0.25s_cubic-bezier(0.2,0.7,0.2,1)_both] max-[600px]:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2.5 mb-[18px]">
          <span className={CHIP}>
            <KeyRound size={15} />
          </span>
          <div className="flex-1 min-w-0 pr-1">
            <h3 className={CARD_TITLE}>{isSet ? 'Set a Password' : 'Change Password'}</h3>
            <p className={CARD_SUB}>
              {isSet
                ? 'Add a password beside your Discord sign-in'
                : 'Update your account password for better security'}
            </p>
          </div>
          <button
            type="button"
            className={ICON_BTN}
            onClick={onClose}
            disabled={saving}
            title="Close"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className={noticeCls('error')} role="alert">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <form className={FORM} onSubmit={handleSubmit}>
          {!isSet && (
            <div className={FIELD}>
              <label className={LABEL} htmlFor="pw-current">
                Current Password
              </label>
              <input
                id="pw-current"
                className={INPUT}
                type="password"
                autoComplete="current-password"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={saving}
                autoFocus
              />
            </div>
          )}
          <div className={FIELD}>
            <label className={LABEL} htmlFor="pw-new">
              {isSet ? 'Password' : 'New Password'}
            </label>
            <input
              id="pw-new"
              className={INPUT}
              type="password"
              autoComplete="new-password"
              placeholder={isSet ? 'Choose a password (min. 8)' : 'Enter new password (min. 8)'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={saving}
              autoFocus={isSet}
            />
          </div>
          <div className={FIELD}>
            <label className={LABEL} htmlFor="pw-confirm">
              Confirm Password
            </label>
            <input
              id="pw-confirm"
              className={INPUT}
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={saving}
            />
          </div>

          <p className="text-[12.5px] text-muted pt-1">
            Signed in as{' '}
            <span className="text-text font-bold [overflow-wrap:anywhere]">
              {email || 'session not found'}
            </span>
          </p>

          <div className="flex justify-end gap-2.5 pt-3.5 border-t border-hair max-[420px]:flex-col-reverse">
            <button
              type="button"
              className={BTN_GHOST}
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className={BTN_PRIMARY} disabled={saving}>
              {saving ? 'Saving…' : isSet ? 'Set Password' : 'Change Password'}
            </button>
          </div>
        </form>

        <ConfirmModal
          open={confirmOpen}
          title={isSet ? 'Set this password?' : 'Change your password?'}
          message={
            isSet
              ? 'From now on you can sign in with either Discord or this password. All your other sessions will be signed out.'
              : 'You will need to use the new password the next time you sign in. All your other sessions will be signed out.'
          }
          confirmLabel={isSet ? 'Yes, set it' : 'Yes, change it'}
          cancelLabel="No"
          onConfirm={() => void handleConfirmedChange()}
          onCancel={() => setConfirmOpen(false)}
        />
      </div>
    </div>,
    document.body,
  )
}
