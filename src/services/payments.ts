import { apiFetch } from './api'
import type { CoinsbuyDeposit, PaymentMethods } from '../types/payments'

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
