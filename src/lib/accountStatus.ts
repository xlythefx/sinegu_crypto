/**
 * What an account's `status` is allowed to do, in one place.
 *
 * Client gating is cosmetic, as always: the API refuses a pending user's
 * connect with 403 `PENDING_APPROVAL` whatever the UI shows. What this buys is
 * that the refusal arrives BEFORE the user creates API keys on their exchange
 * and types them into a four-step wizard — being told "no" after that work is
 * the same answer delivered as badly as possible.
 */

import type { UserStatus } from '../types/auth'

/**
 * May this account connect an exchange yet?
 *
 * An unknown status counts as YES on purpose: a session stored before the
 * field existed has none, and failing closed there would lock an approved user
 * out of their own wizard over a missing key. The server is the real gate.
 */
export function canConnectExchanges(status: UserStatus | undefined): boolean {
  return status !== 'pending' && status !== 'suspended'
}
