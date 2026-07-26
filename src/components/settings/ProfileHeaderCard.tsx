import { useState } from 'react'
import { Pencil } from 'lucide-react'
import EditImageDialog, { type EditImageType } from './EditImageDialog'
import { updateStoredUser } from '../../lib/session'
import { useSessionUser } from '../../hooks/useSessionUser'
import { uploadProfileImage } from '../../services/user'
import { getApiErrorMessage } from '../../services/api'
import type { AuthUser } from '../../types/auth'

interface ProfileHeaderCardProps {
  user: AuthUser | null
}

/**
 * Banner + avatar header. Images upload to POST /user/image and persist on the
 * backend (user_credentials); the returned URL is synced into the session so it
 * also appears in the top bar and landing nav.
 */
export default function ProfileHeaderCard({ user }: ProfileHeaderCardProps) {
  const sessionUser = useSessionUser()
  const [editing, setEditing] = useState<EditImageType | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const name = user?.name || sessionUser?.name || 'Trader'
  const initial = name.charAt(0).toUpperCase()
  const avatarUrl = sessionUser?.user_profile ?? user?.user_profile ?? null
  const bannerUrl = sessionUser?.user_banner ?? user?.user_banner ?? null

  const openEditor = (type: EditImageType) => {
    setError(null)
    setEditing(type)
  }

  const handleApply = async (file: File) => {
    if (!editing) return
    setBusy(true)
    setError(null)
    try {
      const res = await uploadProfileImage(editing, file)
      // Sync the returned absolute URL into the session (nav + top bars react)
      updateStoredUser({
        user_profile: res.user.user_profile ?? null,
        user_banner: res.user.user_banner ?? null,
      })
      setEditing(null)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not upload the image.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="dcard sph" data-aos="fade-up">
      <div className="sph__banner">
        {bannerUrl && <img src={bannerUrl} alt="Profile banner" />}
        <div className="sph__banner-edit">
          <button
            type="button"
            className="sbtn sbtn--ghost"
            onClick={() => openEditor('banner')}
          >
            <Pencil size={14} />
            Edit Banner
          </button>
        </div>
      </div>

      <div className="sph__body">
        <div className="sph__row">
          <div className="sph__avatar-wrap">
            <div className="sph__avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt={`${name} avatar`} />
              ) : (
                <span className="sph__initial display">{initial}</span>
              )}
            </div>
            <div className="sph__avatar-edit">
              <button
                type="button"
                className="sph__avatar-btn"
                onClick={() => openEditor('profile')}
                aria-label="Edit profile image"
              >
                <Pencil size={13} />
              </button>
            </div>
          </div>
          <div className="sph__id">
            <h2 className="sph__name display">{name}</h2>
            <p className="sph__email">{user?.email || '—'}</p>
          </div>
        </div>
      </div>

      <EditImageDialog
        open={editing !== null}
        type={editing ?? 'banner'}
        busy={busy}
        error={error}
        onCancel={() => {
          if (!busy) setEditing(null)
        }}
        onApply={handleApply}
      />
    </section>
  )
}
