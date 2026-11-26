/**
 * Where "Back to Users" lands: User Management's own address, filters
 * included (2026-11-26). The list writes it whenever its address changes; the
 * customer page reads it for Back and after a delete.
 *
 * Session storage (one browser tab), not router state: the customer page
 * rewrites its own `?tab=`, and that navigation drops any state the list
 * passed in. Storage can be off (private mode) — then Back lands on the plain
 * list, as it always did.
 */
const KEY = 'pixel-alpha.admin-users.list-search'

export type UsersGroup = 'users' | 'staff'

export function rememberUsersList(search: string): void {
  try {
    sessionStorage.setItem(KEY, search)
  } catch {
    // Storage blocked: Back falls back to the plain list.
  }
}

/**
 * The list to return to for someone listed under `group`. The remembered
 * address is used only when it shows that same group (Users / Staff), so a
 * staff profile reached from elsewhere never lands on the customers' filters.
 */
export function usersListPath(group: UsersGroup): string {
  let search = ''
  try {
    search = sessionStorage.getItem(KEY) ?? ''
  } catch {
    // Storage blocked.
  }
  const rememberedGroup: UsersGroup = new URLSearchParams(search).get('group') === 'staff' ? 'staff' : 'users'
  if (search.startsWith('?') && rememberedGroup === group) return `/admin/users${search}`
  return group === 'staff' ? '/admin/users?group=staff' : '/admin/users'
}
