import { Code2, Crown, Handshake, Shield } from 'lucide-react'
import type { UserRole, UserStatus } from '../../types/admin'

/** Base pill badge shared across admin tables and cards. */
export const BADGE =
  'inline-flex items-center rounded-pill border py-[3px] px-2.5 text-[11px] font-bold whitespace-nowrap'

/** rgba/color-mix tints preserved exactly from the original CSS. */
export const STATUS_BADGE: Record<UserStatus, string> = {
  active:
    'bg-[color-mix(in_srgb,var(--green)_12%,transparent)] border-[color-mix(in_srgb,var(--green)_35%,transparent)] text-green',
  pending: 'bg-accent-soft border-accent-line text-accent',
  suspended:
    'bg-[color-mix(in_srgb,var(--red)_10%,transparent)] border-[color-mix(in_srgb,var(--red)_35%,transparent)] text-red',
}

/**
 * Crown for master, shield for admin, angle-brackets for developer,
 * handshake for the read-only collaborator — plain users get no badge.
 */
export function RoleBadge({ role }: { role: UserRole }) {
  if (role === 'master') {
    return (
      <span
        className={`${BADGE} gap-[5px] bg-accent-soft border-accent-line text-accent`}
      >
        <Crown size={11} />
        Master
      </span>
    )
  }
  if (role === 'admin') {
    return (
      <span
        className={`${BADGE} gap-[5px] bg-[color-mix(in_srgb,#4f8ef7_12%,transparent)] border-[color-mix(in_srgb,#4f8ef7_35%,transparent)] text-[#4f8ef7]`}
      >
        <Shield size={11} />
        Admin
      </span>
    )
  }
  if (role === 'developer') {
    return (
      <span
        className={`${BADGE} gap-[5px] bg-[color-mix(in_srgb,#a78bfa_14%,transparent)] border-[color-mix(in_srgb,#a78bfa_38%,transparent)] text-[#a78bfa]`}
      >
        <Code2 size={11} />
        Developer
      </span>
    )
  }
  if (role === 'collaborator') {
    return (
      <span
        className={`${BADGE} gap-[5px] bg-[color-mix(in_srgb,var(--teal)_12%,transparent)] border-[color-mix(in_srgb,var(--teal)_38%,transparent)] text-teal`}
      >
        <Handshake size={11} />
        Collaborator
      </span>
    )
  }
  return null
}

export function StatusBadge({ status }: { status: UserStatus }) {
  return (
    <span className={`${BADGE} ${STATUS_BADGE[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}
