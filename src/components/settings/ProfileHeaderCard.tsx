import { useState } from 'react'
import { Pencil } from 'lucide-react'
import EditImageDialog, { type EditImageType } from './EditImageDialog'
import { updateStoredUser } from '../../lib/session'
import { useSessionUser } from '../../hooks/useSessionUser'
import { uploadProfileImage } from '../../services/user'
import { getApiErrorMessage } from '../../services/api'
import { BTN_GHOST } from './formClasses'
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
    <section
      className="group/banner rounded-card border border-border bg-surface overflow-hidden mb-4"
      data-aos="fade-up"
    >
      <div className="relative h-[170px] border-b border-hair bg-[radial-gradient(circle_at_28%_20%,var(--glow),transparent_55%),radial-gradient(circle_at_74%_82%,var(--bubble),transparent_50%),linear-gradient(135deg,var(--accentSoft),var(--surface2))]">
        {bannerUrl && (
          <img
            src={bannerUrl}
            alt="Profile banner"
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-[background,opacity] duration-[250ms] group-hover/banner:bg-black/35 group-hover/banner:opacity-100 group-focus-within/banner:bg-black/35 group-focus-within/banner:opacity-100">
          <button
            type="button"
            className={BTN_GHOST}
            onClick={() => openEditor('banner')}
          >
            <Pencil size={14} />
            Edit Banner
          </button>
        </div>
      </div>

      <div className="px-6 pb-5 max-[900px]:px-4 max-[900px]:pb-4">
        <div className="flex items-end gap-4 mt-[-44px]">
          <div className="relative w-24 h-24 flex-none">
            <div className="w-24 h-24 rounded-full border-4 border-surface flex items-center justify-center overflow-hidden shadow-[0_14px_30px_rgba(0,0,0,0.25)] bg-[radial-gradient(circle_at_32%_28%,var(--glow),transparent_60%),linear-gradient(135deg,var(--accentSoft),var(--surface2))]">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={`${name} avatar`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-display text-[30px] font-extrabold text-accent">
                  {initial}
                </span>
              )}
            </div>
            <div className="absolute right-0 bottom-1">
              <button
                type="button"
                className="flex items-center justify-center w-7 h-7 rounded-full border border-accent-line bg-surface text-accent cursor-pointer shadow-[0_6px_16px_rgba(0,0,0,0.25)] transition-[background] duration-150 hover:bg-accent-soft"
                onClick={() => openEditor('profile')}
                aria-label="Edit profile image"
              >
                <Pencil size={13} />
              </button>
            </div>
          </div>
          <div className="pb-1 min-w-0">
            <h2 className="font-display text-[22px] font-extrabold tracking-[-0.02em]">
              {name}
            </h2>
            <p className="text-[13px] text-muted mt-0.5 [overflow-wrap:anywhere]">
              {user?.email || '—'}
            </p>
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
