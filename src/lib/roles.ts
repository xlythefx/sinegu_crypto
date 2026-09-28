/**
 * Role predicates — one definition of who sees what, so a gate is never
 * re-spelled slightly differently in two places.
 *
 * Client-side gating is cosmetic. Every rule here has a server-side twin:
 * `admin` middleware for the portal, `staff` middleware (EnsureStaff) for the
 * read-only routes a collaborator may call, `developer` middleware for the
 * Database console, and PaymentController::applyRoleOverrides for test-mode
 * payments.
 */

import type { UserRole } from '../types/auth'

/**
 * FULL admins — the twin of the API's `EnsureAdmin::ROLES`. Besides the portal
 * this gates staff-only exchanges (`components/exchanges/meta.ts`) and the
 * calendar's edit gesture, so a collaborator is deliberately NOT in it.
 */
export const ADMIN_ROLES: readonly UserRole[] = ['admin', 'master', 'developer']

/** Everyone who may open the admin portal at all: full admins + collaborators. */
export const STAFF_ROLES: readonly UserRole[] = [...ADMIN_ROLES, 'collaborator']

/** Full admin (write access). See ADMIN_ROLES for what else this gates. */
export function canSeeAdmin(role: UserRole | undefined): boolean {
  return role !== undefined && ADMIN_ROLES.includes(role)
}

/** May open the admin portal — full admins and read-only collaborators. */
export function canSeeAdminPortal(role: UserRole | undefined): boolean {
  return role !== undefined && STAFF_ROLES.includes(role)
}

/**
 * Read-only staff: sees the dashboard overview, users and strategies, and
 * never a write control. The API's `staff` route group is the enforcement.
 */
export function isCollaborator(role: UserRole | undefined): boolean {
  return role === 'collaborator'
}

/**
 * The admin paths a collaborator may open. Everything else in the portal
 * redirects to /admin (AdminLayout) — the API would 403 it anyway.
 */
export function collaboratorMayOpen(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/admin') return true
  return ['/admin/users', '/admin/strategies'].some(
    (base) => path === base || path.startsWith(`${base}/`),
  )
}

/**
 * Developer-only surfaces: the Database console, and invoice payments that run
 * against the providers' test credentials instead of real money.
 */
export function isDeveloper(role: UserRole | undefined): boolean {
  return role === 'developer'
}
