import type { PaymentKind } from '../types/admin'

/** The rail an invoice's `payment_provider` names (the badge Stripe / Crypto / By hand). */
export function paymentKind(provider: string | null | undefined): PaymentKind {
  switch (provider) {
    case 'stripe':
      return 'card'
    case 'tron':
    case 'coinsbuy':
      return 'crypto'
    case 'manual':
      return 'manual'
    default:
      return 'unknown'
  }
}
