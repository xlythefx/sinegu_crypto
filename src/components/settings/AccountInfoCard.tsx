import { useState } from 'react'
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Mail,
  Pencil,
  Save,
  Shield,
  User,
  X,
} from 'lucide-react'
import { getApiErrorMessage } from '../../services/api'
import { updateProfile } from '../../services/user'
import { saveUser } from '../../lib/session'
import { formatDate } from '../../lib/format'
import type { AuthUser } from '../../types/auth'

interface AccountInfoCardProps {
  user: AuthUser | null
  loading: boolean
  onUserChange: (user: AuthUser) => void
}

type Notice = { kind: 'success' | 'error'; text: string } | null

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  pending: 'Pending',
  suspended: 'Suspended',
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Name / email / status / member-since — wired to GET /auth/me + PUT /user/profile. */
export default function AccountInfoCard({
  user,
  loading,
  onUserChange,
}: AccountInfoCardProps) {
  const [editMode, setEditMode] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const status = user?.status ?? ''
  const statusBadge = (
    <span className={`sbadge sbadge--${status || 'unknown'}`}>
      {STATUS_LABELS[status] ?? (status || '—')}
    </span>
  )

  const startEdit = () => {
    setName(user?.name ?? '')
    setEmail(user?.email ?? '')
    setNotice(null)
    setEditMode(true)
  }

  const cancelEdit = () => {
    setEditMode(false)
    setNotice(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()

    if (!trimmedName || !trimmedEmail) {
      setNotice({ kind: 'error', text: 'Please fill in both name and email.' })
      return
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setNotice({ kind: 'error', text: 'Please enter a valid email address.' })
      return
    }

    setSaving(true)
    setNotice(null)
    try {
      const res = await updateProfile(trimmedName, trimmedEmail)
      saveUser(res.user)
      onUserChange(res.user)
      setEditMode(false)
      setNotice({
        kind: 'success',
        text: res.message || 'Profile updated successfully.',
      })
    } catch (err) {
      setNotice({
        kind: 'error',
        text: getApiErrorMessage(err, 'Unable to update profile. Please try again.'),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="dcard set-card" data-aos="fade-up">
      <div className="dcard__title-row set-card__head">
        <span className="dchip">
          <User size={15} />
        </span>
        <div className="set-card__titles">
          <h3 className="dcard__title">Account Information</h3>
          <p className="dcard__sub">Your personal account details</p>
        </div>
        {!loading && !editMode && (
          <button type="button" className="sbtn sbtn--ghost sbtn--sm" onClick={startEdit}>
            <Pencil size={13} />
            Edit
          </button>
        )}
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

      {loading && !user ? (
        <p className="set-loading">Loading account…</p>
      ) : editMode ? (
        <form className="set-form" onSubmit={handleSubmit}>
          <div className="sfield">
            <label className="sfield__label" htmlFor="acc-name">
              <User size={13} />
              Full Name
            </label>
            <input
              id="acc-name"
              className="sinput"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              required
            />
          </div>
          <div className="sfield">
            <label className="sfield__label" htmlFor="acc-email">
              <Mail size={13} />
              Email Address
            </label>
            <input
              id="acc-email"
              className="sinput"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              required
            />
          </div>
          <div className="sfield">
            <span className="sfield__label">
              <Shield size={13} />
              Account Status
            </span>
            <div>{statusBadge}</div>
          </div>
          <div className="sfield">
            <span className="sfield__label">
              <Calendar size={13} />
              Member Since
            </span>
            <p className="set-value">{formatDate(user?.created_at)}</p>
          </div>
          <div className="set-form__actions">
            <button
              type="button"
              className="sbtn sbtn--ghost sbtn--sm"
              onClick={cancelEdit}
              disabled={saving}
            >
              <X size={13} />
              Cancel
            </button>
            <button type="submit" className="sbtn sbtn--primary sbtn--sm" disabled={saving}>
              <Save size={13} />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="set-fields">
            <div className="sfield">
              <span className="sfield__label">
                <User size={13} />
                Full Name
              </span>
              <p className="set-value set-value--lg">{user?.name || '—'}</p>
            </div>
            <div className="sfield">
              <span className="sfield__label">
                <Mail size={13} />
                Email Address
              </span>
              <p className="set-value set-value--lg">{user?.email || '—'}</p>
            </div>
            <div className="sfield">
              <span className="sfield__label">
                <Shield size={13} />
                Account Status
              </span>
              <div>{statusBadge}</div>
            </div>
            <div className="sfield">
              <span className="sfield__label">
                <Calendar size={13} />
                Member Since
              </span>
              <p className="set-value set-value--lg">{formatDate(user?.created_at)}</p>
            </div>
          </div>
          {status === 'pending' && (
            <div className="snotice snotice--warn">
              <AlertCircle size={15} />
              <span>
                Your account is pending approval. All features unlock once your
                account is activated.
              </span>
            </div>
          )}
        </>
      )}
    </section>
  )
}
