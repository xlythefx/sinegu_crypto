import { apiFetch } from './api'
import type {
  CoinsbuyDeposit,
  PaymentMethods,
  TronIntent,
  TronIntentStatus,
} from '../types/payments'

/**
 * Used only until `/payments/methods` answers — the server is the authority on
 * what Coinsbuy accepts (it validates the coin again on the deposit call).
 */
export const FALLBACK_CRYPTOCURRENCIES = ['BTC', 'ETH', 'USDT', 'USDC']

interface ApiPaymentMethods {
  success: boolean
  environment: string
  test_account: boolean
  stripe: { enabled: boolean; mode: string; reason: string | null }
  coinsbuy: {
    enabled: boolean
    mode: string
    default_cryptocurrency: string
    cryptocurrencies: string[]
  }
  default_provider?: string
  tron?: {
    enabled: boolean
    visible: boolean
    network: string
    asset: string
    chain_label: string
  }
  /** Only sent to `developer` accounts — see PaymentController::debugEnvelope. */
  debug?: Record<string, unknown>
}

interface ApiCoinsbuyDeposit {
  success: boolean
  provider: 'coinsbuy'
  mode: string
  test_account: boolean
  deposit_id: string
  tracking_id: string
  payment_type: 'payment_page' | 'destination_address'
  payment_url: string | null
  destination: string | null
  cryptocurrency: string
  amount: number
  currency: string
}

/** GET /payments/methods — which providers are live, and in which mode. */
export async function getPaymentMethods(): Promise<PaymentMethods> {
  const res = await apiFetch<ApiPaymentMethods>('/payments/methods', { auth: true })
  return {
    environment: res.environment,
    testAccount: res.test_account ?? false,
    stripe: res.stripe,
    coinsbuy: {
      enabled: res.coinsbuy.enabled,
      mode: res.coinsbuy.mode,
      defaultCryptocurrency: res.coinsbuy.default_cryptocurrency,
      cryptocurrencies: res.coinsbuy.cryptocurrencies ?? FALLBACK_CRYPTOCURRENCIES,
    },
    defaultProvider: res.default_provider ?? 'coinsbuy',
    // Absent on an API that predates the rail — treated as "not there".
    tron: {
      enabled: res.tron?.enabled ?? false,
      visible: res.tron?.visible ?? false,
      network: res.tron?.network ?? '',
      asset: res.tron?.asset ?? 'USDT',
      chainLabel: res.tron?.chain_label ?? 'TRC-20 (TRON)',
    },
    debug: res.debug,
  }
}

/**
 * POST /payments/coinsbuy/deposit — opens a Coinsbuy deposit for an invoice and
 * returns where to send the trader. The charged amount comes from the invoice
 * row server-side; `amount` is only a stale-tab guard (409 AMOUNT_MISMATCH).
 */
export async function createCoinsbuyDeposit(params: {
  invoiceId: string | number
  cryptocurrency: string
  amount?: number
}): Promise<CoinsbuyDeposit> {
  const res = await apiFetch<ApiCoinsbuyDeposit>('/payments/coinsbuy/deposit', {
    method: 'POST',
    auth: true,
    body: {
      invoice_id: Number(params.invoiceId),
      cryptocurrency: params.cryptocurrency,
      amount: params.amount,
    },
  })
  return {
    depositId: res.deposit_id,
    trackingId: res.tracking_id,
    mode: res.mode,
    testAccount: res.test_account ?? false,
    paymentType: res.payment_type,
    paymentUrl: res.payment_url,
    destination: res.destination,
    cryptocurrency: res.cryptocurrency,
    amount: res.amount,
    currency: res.currency,
  }
}

/**
 * POST /payments/stripe/checkout-session — opens a hosted Stripe Checkout for
 * an invoice and returns the URL to send the trader to. As with the crypto
 * rails, the charged amount comes from the invoice row server-side and `amount`
 * is only the stale-tab guard; the invoice settles on Stripe's signed webhook,
 * never on the trader's return.
 */
export async function createStripeCheckout(params: {
  invoiceId: string | number
  amount?: number
}): Promise<{ checkoutUrl: string; sessionId: string; mode: string }> {
  const res = await apiFetch<{
    success: boolean
    provider: 'stripe'
    mode: string
    session_id: string
    checkout_url: string
  }>('/payments/stripe/checkout-session', {
    method: 'POST',
    auth: true,
    body: { invoice_id: Number(params.invoiceId), amount: params.amount },
  })
  return { checkoutUrl: res.checkout_url, sessionId: res.session_id, mode: res.mode }
}

interface ApiTronIntent {
  success: boolean
  provider: 'tron'
  network: string
  test_account: boolean
  reused: boolean
  intent_id: number
  invoice_id: number
  asset: string
  chain_label: string
  address: string
  contract_address: string
  decimals: number
  amount: string
  amount_units: string
  usd_amount: number
  currency: string
  tolerance: { shortfall_usd: number; overpay_usd: number }
  expires_at: string | null
  seconds_remaining: number
  status: string
  explorer_url: string
  simulatable: boolean
  debug?: Record<string, unknown>
}

/**
 * POST /payments/tron/intent — reserve an exact USDT-TRC20 amount for an
 * invoice and get the address to send it to.
 *
 * The NETWORK is chosen server-side from the caller's role and cannot be
 * requested: a client that could name it would settle a real invoice with
 * testnet tokens. `amount` is only the stale-tab guard, as with Coinsbuy.
 */
export async function createTronIntent(params: {
  invoiceId: string | number
  amount?: number
}): Promise<TronIntent> {
  const res = await apiFetch<ApiTronIntent>('/payments/tron/intent', {
    method: 'POST',
    auth: true,
    body: { invoice_id: Number(params.invoiceId), amount: params.amount },
  })
  return {
    intentId: res.intent_id,
    invoiceId: res.invoice_id,
    network: res.network,
    testAccount: res.test_account ?? false,
    reused: res.reused ?? false,
    asset: res.asset,
    chainLabel: res.chain_label,
    address: res.address,
    contractAddress: res.contract_address,
    decimals: res.decimals,
    amount: res.amount,
    amountUnits: res.amount_units,
    usdAmount: res.usd_amount,
    currency: res.currency,
    tolerance: {
      shortfallUsd: res.tolerance?.shortfall_usd ?? 0,
      overpayUsd: res.tolerance?.overpay_usd ?? 0,
    },
    expiresAt: res.expires_at,
    secondsRemaining: res.seconds_remaining ?? 0,
    status: res.status,
    explorerUrl: res.explorer_url,
    simulatable: res.simulatable ?? false,
    debug: res.debug,
  }
}

interface ApiTronIntentStatus {
  success: boolean
  invoice_id: number
  invoice_status: 'paid' | 'pending'
  intent: {
    id: number
    status: string
    network: string
    address: string
    amount: string
    expires_at: string | null
    seconds_remaining: number
  } | null
  transfer: {
    tx_hash: string
    amount: string
    confirmed: boolean
    status: string
    seen_at: string | null
    explorer_url: string
  } | null
  last_scan_at: string | null
  scan_stale: boolean
}

/**
 * GET /payments/tron/intent/{invoiceId} — polled by the pay sheet.
 *
 * Answers 200 for a PAID invoice, unlike the create call which 409s: paid is
 * exactly the state this is watching for.
 */
export async function getTronIntentStatus(
  invoiceId: string | number,
): Promise<TronIntentStatus> {
  const res = await apiFetch<ApiTronIntentStatus>(
    `/payments/tron/intent/${Number(invoiceId)}`,
    { auth: true },
  )
  return {
    invoiceId: res.invoice_id,
    invoiceStatus: res.invoice_status,
    intent: res.intent && {
      id: res.intent.id,
      status: res.intent.status,
      network: res.intent.network,
      address: res.intent.address,
      amount: res.intent.amount,
      expiresAt: res.intent.expires_at,
      secondsRemaining: res.intent.seconds_remaining,
    },
    transfer: res.transfer && {
      txHash: res.transfer.tx_hash,
      amount: res.transfer.amount,
      confirmed: res.transfer.confirmed,
      status: res.transfer.status,
      seenAt: res.transfer.seen_at,
      explorerUrl: res.transfer.explorer_url,
    },
    lastScanAt: res.last_scan_at,
    scanStale: res.scan_stale ?? false,
  }
}

/**
 * POST /payments/tron/intent/{invoiceId}/simulate — the developer test button.
 *
 * Settles the invoice as though the money had arrived, so rehearsing the flow
 * does not need a real testnet transfer every time. The server refuses this for
 * any non-developer AND on whichever network carries real money, so a UI slip
 * cannot forge revenue.
 */
export async function simulateTronPayment(
  invoiceId: string | number,
): Promise<{ txHash: string; amount: string; message: string }> {
  const res = await apiFetch<{
    success: boolean
    tx_hash: string
    amount: string
    message: string
  }>(`/payments/tron/intent/${Number(invoiceId)}/simulate`, { method: 'POST', auth: true })

  return { txHash: res.tx_hash, amount: res.amount, message: res.message }
}
