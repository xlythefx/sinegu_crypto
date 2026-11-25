import type { LucideIcon } from 'lucide-react'

export interface AdminNavItem {
  label: string
  url: string
  icon: LucideIcon
  /** Hidden from admin/master — only `developer` accounts see it. */
  developerOnly?: boolean
  /**
   * Visible to the read-only `collaborator` role. Everything else is hidden
   * from them (and AdminLayout redirects those paths) — keep this in step
   * with `collaboratorMayOpen` in lib/roles.ts.
   */
  collaborator?: boolean
}

/** A folder of pages in the admin sidebar (owner, 2026-11-25). */
export interface AdminNavGroup {
  /** Stable slug: a device remembers the groups it opened by this id. */
  id: string
  label: string
  icon: LucideIcon
  items: AdminNavItem[]
}

export type AdminNavEntry = AdminNavItem | AdminNavGroup

export function isNavGroup(entry: AdminNavEntry): entry is AdminNavGroup {
  return 'items' in entry
}
