/** Invoice payment providers — shapes returned by `/api/payments/*`. */

/** 'live' | 'test' for Stripe, 'production' | 'sandbox' for Coinsbuy. */
export type ProviderMode = string

export interface PaymentMethods {
  /** Which environment the API decided it is running in. */
  environment: string
  /**
   * True when THIS caller pays with the providers' test credentials whatever
   * the machine — i.e. a `developer` account. Real buttons, real endpoints,
   * real webhook, no real money.
   */
  testAccount: boolean
  stripe: {
    enabled: boolean
    mode: ProviderMode
    /** Why the mode was downgraded, when it was. */
    reason: string | null
  }
  coinsbuy: {
    enabled: boolean
    mode: ProviderMode
    defaultCryptocurrency: string
    cryptocurrencies: string[]
  }
  /**
   * Which keys are set, where the callbacks point, why this box resolved the
   * way it did. Present ONLY for `developer` accounts — the API decides that,
   * so on a trader session this is simply absent.
   */
  debug?: Record<string, unknown>
}

/**
 * A created Coinsbuy deposit. `payment_page` is the normal path (a hosted
 * checkout to redirect to); `destination_address` is the Enterprise-wallet
 * fallback, where the user sends coins to `destination` themselves.
 */
export interface CoinsbuyDeposit {
  depositId: string
  trackingId: string
  mode: ProviderMode
  /** The deposit was opened against test credentials (developer account). */
  testAccount: boolean
  paymentType: 'payment_page' | 'destination_address'
  paymentUrl: string | null
  destination: string | null
  cryptocurrency: string
  amount: number
  currency: string
}
