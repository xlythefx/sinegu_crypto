/**
 * Role predicates — one definition of who sees what, so a gate is never
 * re-spelled slightly differently in two places.
 *
 * Client-side gating is cosmetic. Every rule here has a server-side twin:
 * `admin` middleware for the portal, `developer` middleware for the Database
 * console, and PaymentController::applyRoleOverrides for test-mode payments.
 */

import type { UserRole } from '../types/auth'

/** May open the admin portal. */
export const ADMIN_ROLES: readonly UserRole[] = ['admin', 'master', 'developer']

export function canSeeAdmin(role: UserRole | undefined): boolean {
  return role !== undefined && ADMIN_ROLES.includes(role)
}

/**
 * Developer-only surfaces: the Database console, and invoice payments that run
 * against the providers' test credentials instead of real money.
 */
export function isDeveloper(role: UserRole | undefined): boolean {
  return role === 'developer'
}
