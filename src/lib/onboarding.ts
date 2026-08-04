/**
 * Per-user onboarding flags, keyed by uni_id so accounts sharing a browser
 * never see each other's dismissals.
 *
 * - Pending ack lives in sessionStorage: the "pending approval" modal comes
 *   back in a fresh tab/session but not on reloads or navigation.
 * - The connect prompt lives in localStorage: "you're approved — connect an
 *   exchange" is shown exactly once, ever.
 */

const pendingAckKey = (uniId: string) => `sinegu-pending-ack:${uniId}`
const connectSeenKey = (uniId: string) => `sinegu-connect-prompt-seen:${uniId}`

export function hasPendingAck(uniId: string): boolean {
  return sessionStorage.getItem(pendingAckKey(uniId)) !== null
}

export function ackPending(uniId: string): void {
  sessionStorage.setItem(pendingAckKey(uniId), '1')
}

export function hasSeenConnectPrompt(uniId: string): boolean {
  return localStorage.getItem(connectSeenKey(uniId)) !== null
}

export function markConnectPromptSeen(uniId: string): void {
  localStorage.setItem(connectSeenKey(uniId), '1')
}
