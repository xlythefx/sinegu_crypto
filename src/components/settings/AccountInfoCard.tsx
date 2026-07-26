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
import {
  BTN_GHOST_SM,
  BTN_PRIMARY_SM,
  CARD,
  CARD_HEAD,
  CARD_SUB,
  CARD_TITLE,
  CARD_TITLES,
  CHIP,
  FIELD,
  FIELDS,
  FORM,
  FORM_ACTIONS,
  LABEL,
  LOADING,
  VALUE,
  VALUE_LG,
  INPUT,
  badge,
  notice as noticeCls,
} from './formClasses'
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
    <span className={badge(status)}>
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
    <section className={`${CARD} flex flex-col`} data-aos="fade-up">
      <div className={CARD_HEAD}>
        <span className={CHIP}>
          <User size={15} />
        </span>
        <div className={CARD_TITLES}>
          <h3 className={CARD_TITLE}>Account Information</h3>
          <p className={CARD_SUB}>Your personal account details</p>
        </div>
        {!loading && !editMode && (
          <button type="button" className={BTN_GHOST_SM} onClick={startEdit}>
            <Pencil size={13} />
            Edit
          </button>
        )}
      </div>

      {notice && (
        <div className={noticeCls(notice.kind)} role="status">
          {notice.kind === 'success' ? (
            <CheckCircle2 size={15} />
          ) : (
            <AlertCircle size={15} />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {loading && !user ? (
        <p className={LOADING}>Loading account…</p>
      ) : editMode ? (
        <form className={FORM} onSubmit={handleSubmit}>
          <div className={FIELD}>
            <label className={LABEL} htmlFor="acc-name">
              <User size={13} />
              Full Name
            </label>
            <input
              id="acc-name"
              className={INPUT}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              required
            />
          </div>
          <div className={FIELD}>
            <label className={LABEL} htmlFor="acc-email">
              <Mail size={13} />
              Email Address
            </label>
            <input
              id="acc-email"
              className={INPUT}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              required
            />
          </div>
          <div className={FIELD}>
            <span className={LABEL}>
              <Shield size={13} />
              Account Status
            </span>
            <div>{statusBadge}</div>
          </div>
          <div className={FIELD}>
            <span className={LABEL}>
              <Calendar size={13} />
              Member Since
            </span>
            <p className={VALUE}>{formatDate(user?.created_at)}</p>
          </div>
          <div className={FORM_ACTIONS}>
            <button
              type="button"
              className={BTN_GHOST_SM}
              onClick={cancelEdit}
              disabled={saving}
            >
              <X size={13} />
              Cancel
            </button>
            <button type="submit" className={BTN_PRIMARY_SM} disabled={saving}>
              <Save size={13} />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className={FIELDS}>
            <div className={FIELD}>
              <span className={LABEL}>
                <User size={13} />
                Full Name
              </span>
              <p className={VALUE_LG}>{user?.name || '—'}</p>
            </div>
            <div className={FIELD}>
              <span className={LABEL}>
                <Mail size={13} />
                Email Address
              </span>
              <p className={VALUE_LG}>{user?.email || '—'}</p>
            </div>
            <div className={FIELD}>
              <span className={LABEL}>
                <Shield size={13} />
                Account Status
              </span>
              <div>{statusBadge}</div>
            </div>
            <div className={FIELD}>
              <span className={LABEL}>
                <Calendar size={13} />
                Member Since
              </span>
              <p className={VALUE_LG}>{formatDate(user?.created_at)}</p>
            </div>
          </div>
          {status === 'pending' && (
            <div className={noticeCls('warn')}>
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
