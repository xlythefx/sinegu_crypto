/**
 * Static prototype data for the Stripe card-on-file, which is currently hidden
 * from Settings (see PaymentMethodCard). Everything else on the page is live:
 * payout wallets + bank wire accounts via services/payoutMethods.ts, account
 * info and password via services/user.ts.
 */

export interface SavedCard {
  id: string
  brand: string
  last4: string
  expiry: string
}

export const SAVED_CARDS: SavedCard[] = [
  { id: 'pm_01', brand: 'Visa', last4: '4242', expiry: '08/27' },
]
