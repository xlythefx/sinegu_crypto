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
 * calendar's edit gesture, so a collaborator is deliberately NOT in it. A
 * `tester` IS (owner, 2026-10-16): internal test accounts are run by staff,
 * who drive the test feed from the portal.
 */
export const ADMIN_ROLES: readonly UserRole[] = ['admin', 'master', 'developer', 'tester']

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
 * never a write control — except on Admin → Creatives, the marketing team's
 * page (collaborators ARE the marketing team, owner 2026-11-10). The API's
 * `staff` route group is the enforcement.
 */
export function isCollaborator(role: UserRole | undefined): boolean {
  return role === 'collaborator'
}

/**
 * The admin paths a collaborator may open. Everything else in the portal
 * redirects to /admin (AdminLayout) — the API would 403 it anyway.
 *
 * All of them are read-only for a collaborator but `/admin/creatives`
 * (content plans, the character, Higgsfield generations): the ONE admin area
 * they may WRITE, through the API's `admin/creatives` staff group. Even there
 * the monthly cap stays full-admin (`can_edit_budget`).
 */
export function collaboratorMayOpen(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/admin') return true
  return ['/admin/users', '/admin/strategies', '/admin/visitors', '/admin/creatives'].some(
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

/**
 * Internal test account: the full admin portal (it is in ADMIN_ROLES), but its
 * exchange accounts trade the engine's separate TEST feed and never the main
 * TradingView webhooks, nothing from that feed is posted publicly, and it is
 * never billed or counted as a customer. Its Positions page has a "Fetch"
 * button (POST /user/positions/refresh, testers only). No developer-only
 * surface — those check `isDeveloper`.
 */
export function isTester(role: UserRole | undefined): boolean {
  return role === 'tester'
}

/**
 * Sub-master: a second house account that trades its OWN signal feed (the
 * engine's `submaster` webhooks, real money, announced in the admin chat
 * only). Trader dashboard ONLY — deliberately in neither ADMIN_ROLES nor
 * STAFF_ROLES, so it never opens the portal. Never billed, never counted as a
 * customer, and its streak sizing follows its own run, not the master's.
 */
export function isSubmaster(role: UserRole | undefined): boolean {
  return role === 'submaster'
}

/**
 * Roles whose exchange accounts trade a feed of their own rather than the
 * main one. Moving a user into or out of one (or between them) switches
 * feeds, which the API refuses while a position is open (409 OPEN_POSITIONS).
 */
export function hasOwnFeed(role: UserRole | undefined): boolean {
  return role === 'tester' || role === 'submaster'
}
