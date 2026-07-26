import type { AuthUser } from '../../types/auth'
import './UserAvatar.css'

interface UserAvatarProps {
  user: Pick<AuthUser, 'name' | 'user_profile'> | null
  size?: number
  className?: string
}

/** Circular avatar: the user's profile image if set, else their first initial. */
export default function UserAvatar({
  user,
  size = 34,
  className = '',
}: UserAvatarProps) {
  const name = user?.name?.trim() || 'Trader'
  const initial = name.charAt(0).toUpperCase()
  const image = user?.user_profile

  return (
    <span
      className={`uavatar ${className}`}
      style={{ width: size, height: size, fontSize: size }}
      aria-label={name}
    >
      {image ? (
        <img src={image} alt="" />
      ) : (
        <span className="uavatar__initial">{initial}</span>
      )}
    </span>
  )
}
