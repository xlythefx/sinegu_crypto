import type { AuthUser } from '../../types/auth'

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
      className={`inline-flex items-center justify-center rounded-full overflow-hidden flex-shrink-0 bg-accent text-on-accent border border-border select-none ${className}`}
      style={{ width: size, height: size, fontSize: size }}
      aria-label={name}
    >
      {image ? (
        <img src={image} alt="" className="w-full h-full object-cover block" />
      ) : (
        <span className="font-display font-extrabold text-[0.44em] leading-none">
          {initial}
        </span>
      )}
    </span>
  )
}
