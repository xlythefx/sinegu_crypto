import type { AuthUser } from '../types/auth'

/** The screen where a signed-in, unverified user redeems their sign-up code. */
export const VERIFY_EMAIL_PATH = '/auth/verify'

/** The API's 403 code for a guarded route called by an unverified user. */
export const EMAIL_UNVERIFIED = 'EMAIL_UNVERIFIED'

/** Length of the mailed code — one box per digit. */
export const VERIFY_CODE_LENGTH = 6

const COMPLETE_CODE = new RegExp(`^\\d{${VERIFY_CODE_LENGTH}}$`)

/** True when every box of a CodeInput value holds a digit. */
export function isCompleteCode(value: string): boolean {
  return COMPLETE_CODE.test(value)
}

/** Seconds before a new code may be requested (the API's own cooldown). */
export const RESEND_COOLDOWN_SECONDS = 60

/**
 * True only when the API has SAID the address is unverified. A session stored
 * before the field existed carries `undefined`, and reading that as "not
 * verified" would lock every existing user out on their next page load — the
 * API's 403 is what catches a genuinely stale session instead.
 */
export function needsEmailVerification(user: AuthUser | null | undefined): boolean {
  return user?.email_verified === false
}

/** Where to send a user straight after sign-in / sign-up. */
export function postAuthPath(user: AuthUser): string {
  return needsEmailVerification(user) ? VERIFY_EMAIL_PATH : '/dashboard'
}
