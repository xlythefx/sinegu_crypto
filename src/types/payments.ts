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
    /**
     * Developer accounts only: which card modes they may pick on this box —
     * `test` (test cards, no money) and `live` (a REAL charge). Absent for
     * everyone else, who always pay in the mode the box resolves to.
     */
    modes?: { test: boolean; live: boolean }
  }
  coinsbuy: {
    enabled: boolean
    mode: ProviderMode
    defaultCryptocurrency: string
    cryptocurrencies: string[]
  }
  /** Which rail a trader is offered by default. Config, not code. */
  defaultProvider: string
  tron: {
    /** The network is configured well enough to quote an address. */
    enabled: boolean
    /**
     * Whether THIS caller may see the rail at all. Deliberately separate from
     * `defaultProvider`: the rail goes visible to everyone well before it
     * becomes the default for everyone.
     */
    visible: boolean
    network: string
    asset: string
    chainLabel: string
  }
  /**
   * Which keys are set, where the callbacks point, why this box resolved the
   * way it did. Present ONLY for `developer` accounts — the API decides that,
   * so on a trader session this is simply absent.
   */
  debug?: Record<string, unknown>
}

/**
 * A reserved USDT-TRC20 amount for one invoice.
 *
 * `amount` is the EXACT figure to send, at full precision — the amount shown is
 * the amount matched, so it must not be rounded for display. The address is a
 * shared receiving wallet; the amount is what identifies the payer, because
 * anyone paying from an exchange arrives with the exchange's address as the
 * sender.
 */
export interface TronIntent {
  intentId: number
  invoiceId: number
  network: string
  /** Issued against test-network tokens (developer account). */
  testAccount: boolean
  /** An existing open reservation was returned rather than a new one minted. */
  reused: boolean
  asset: string
  chainLabel: string
  address: string
  contractAddress: string
  decimals: number
  amount: string
  amountUnits: string
  usdAmount: number
  currency: string
  tolerance: { shortfallUsd: number; overpayUsd: number }
  expiresAt: string | null
  secondsRemaining: number
  status: string
  explorerUrl: string
  /**
   * Whether the developer test button may be shown. The server decides and
   * enforces it again on the endpoint — the button never gets to vote.
   */
  simulatable: boolean
  debug?: Record<string, unknown>
}

/** What the pay sheet polls while it waits for the chain. */
export interface TronIntentStatus {
  invoiceId: number
  invoiceStatus: 'paid' | 'pending'
  intent: {
    id: number
    status: string
    network: string
    address: string
    amount: string
    expiresAt: string | null
    secondsRemaining: number
  } | null
  transfer: {
    txHash: string
    amount: string
    confirmed: boolean
    status: string
    seenAt: string | null
    explorerUrl: string
  } | null
  /**
   * When the watcher last ran. Polling is the only way a TRON payment is ever
   * noticed, so a stalled scheduler has to be visible — otherwise the sheet
   * spins forever on a payment nothing is looking for.
   */
  lastScanAt: string | null
  scanStale: boolean
  /** Non-null when a held payment could be this invoice's — ask for the TXID. */
  claim: TronClaimPrompt | null
}

/**
 * A payment the watcher could not place on its own (two customers paying the
 * same amount, or it arrived after the timer ran out), and this invoice could
 * own it. Never carries the transaction ID — that is what the customer proves.
 *  - `needed`           — nobody has claimed it yet: paste your TXID.
 *  - `claimed_by_other` — another customer confirmed it; if it was yours, say so.
 *  - `disputed`         — you claimed a payment already on someone else's
 *                         invoice; the team is reviewing.
 */
export interface TronClaimPrompt {
  state: 'needed' | 'claimed_by_other' | 'disputed'
  amount: string
  asset: string
  seenAt: string | null
  message: string
}

/** What POST /payments/tron/intent/{id}/claim answered. */
export interface TronClaimResult {
  code: string
  message: string
  settled: boolean
  invoiceStatus: 'paid' | 'pending'
  claim: TronClaimPrompt | null
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

/** What the pay sheet needs to render its success state. */
export interface TronSettlement {
  amount: string
  asset: string
  usdAmount: number
  txHash: string | null
  explorerUrl: string | null
  /** Settled by the developer test button rather than by real funds. */
  simulated: boolean
}
