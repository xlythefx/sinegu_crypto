/**
 * The Binance offer: a customer whose Binance account was CREATED through our
 * referral link pays a lower Pixel Alpha fee on realized profit.
 *
 * One place for the link and every figure the offer quotes — the offer page
 * (`/binance-offer`), Part 1 of the Binance guide, and later the landing
 * section and the connect wizard. A surface that retypes the code or the rate
 * is a second spelling that drifts.
 *
 * What the copy may promise is what billing does: the lower rate applies to
 * REALIZED profit only (the unrealized share is unchanged), from the billing
 * month the account is confirmed, for as long as the customer trades with us
 * on that account. Until billing applies it per account, an admin confirms
 * the account against Binance's referral list and sets that customer's rate
 * on User Management — the page says "we confirm", never "automatically".
 */

/** Public by nature — it is the code a referral link exists to share. */
export const BINANCE_REFERRAL_CODE = 'HPU7VNUZ'
export const BINANCE_REFERRAL_URL = `https://www.binance.com/register?ref=${BINANCE_REFERRAL_CODE}`

/** Percent of realized profit. Standard = every invoice's default rate. */
export const STANDARD_FEE_PCT = 20
export const OFFER_FEE_PCT = 15

export const BINANCE_OFFER_PATH = '/binance-offer'

/** The worked example's month: one round figure everyone can check by hand. */
export const EXAMPLE_PROFIT = 1000

export function feeAt(profit: number, pct: number): number {
  return (profit * pct) / 100
}

export interface OfferStep {
  title: string
  body: string
}

export const OFFER_STEPS: OfferStep[] = [
  {
    title: 'Create your Binance account with our link',
    body: `The Referral ID ${BINANCE_REFERRAL_CODE} fills in by itself. Check it is in the box before you press Create Account.`,
  },
  {
    title: 'Set it up and connect it to Pixel Alpha',
    body: 'Secure it, verify your identity, add USDT and make a trade-only key. Our guide shows every screen.',
  },
  {
    title: `We confirm it — your fee drops to ${OFFER_FEE_PCT}%`,
    body: `We check your account against Binance’s list of accounts made through our link. From the month we confirm it, your invoices charge ${OFFER_FEE_PCT}% instead of ${STANDARD_FEE_PCT}%.`,
  },
]

export const QUALIFIES: string[] = [
  `A new Binance account created through our link, with the Referral ID ${BINANCE_REFERRAL_CODE}.`,
  'Connected to Pixel Alpha and trading with us.',
]

export const DOES_NOT_QUALIFY: string[] = [
  'A Binance account you already had. Binance only counts accounts created through a link, and allows one account per person.',
  'An account created without the Referral ID in the box.',
  'Bybit and MEXC accounts — this offer is for Binance only.',
]

export interface OfferQuestion {
  q: string
  a: string
}

export const OFFER_FAQ: OfferQuestion[] = [
  {
    q: 'I already have a Binance account. Can I still get it?',
    a: `No — Binance only counts accounts created through a referral link, and it allows one account per person, so please do not open a second one. You can connect the account you have at the standard ${STANDARD_FEE_PCT}%.`,
  },
  {
    q: 'When does the lower fee start?',
    a: `From the billing month we confirm your account. Example: confirmed on 15 October, your October invoice (issued on 1 November) already charges ${OFFER_FEE_PCT}%. Invoices from before that month are not changed.`,
  },
  {
    q: 'How long does it last?',
    a: 'For as long as you trade with us on the Binance account you created through our link.',
  },
  {
    q: 'What exactly changes on my invoice?',
    a: `Our fee on realized profit — closed trades — drops from ${STANDARD_FEE_PCT}% to ${OFFER_FEE_PCT}%. Nothing else on the invoice changes, and as always there is no invoice in a month without profit.`,
  },
  {
    q: 'What if I disconnect and connect a different Binance account?',
    a: `The offer belongs to the account created through our link. Reconnect that same account and it stays; a different Binance account is billed at the standard ${STANDARD_FEE_PCT}%.`,
  },
  {
    q: 'How do you confirm it?',
    a: 'Binance shows us which accounts were created through our link, and we match yours once it is connected. If we need anything from you, we will ask.',
  },
  {
    q: 'Does it cost me anything? What do you get?',
    a: 'It costs you nothing. Binance pays us a small share of the trading fees it charges accounts created through our link — out of its own fees, so you pay Binance exactly what anyone else pays. We would rather you hear that from us.',
  },
  {
    q: 'Binance does not serve my country. What then?',
    a: 'Then the offer cannot apply, because the account has to be on binance.com. Bybit and MEXC are coming soon at the standard rate.',
  },
]
