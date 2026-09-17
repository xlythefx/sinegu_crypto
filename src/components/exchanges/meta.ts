import type { ExchangeKind } from '../../types/exchanges'

export interface ExchangeMeta {
  label: string
  /** Brand color (matches the dots used in the top-bar filter). */
  color: string
  available: boolean
  blurb: string
  /**
   * Whether the venue has a futures TESTNET the engine can route a demo
   * account to (Binance: testnet.binancefuture.com; MEXC:
   * futures.testnet.mexc.com). Without one the wizard skips the live/demo
   * step and the API refuses `demo: true` — a "demo" row on such a venue
   * could only ever be a live account wearing the wrong badge.
   */
  hasTestnet: boolean
}

export const EXCHANGE_META: Record<ExchangeKind, ExchangeMeta> = {
  binance: {
    label: 'Binance',
    color: '#f0b90b',
    available: true,
    blurb: 'Connect your Binance account with trade-only API keys',
    hasTestnet: true,
  },
  bybit: {
    label: 'Bybit',
    color: '#f7a600',
    available: false,
    blurb: 'Connect your Bybit account with trade-only API keys',
    hasTestnet: true,
  },
  mexc: {
    label: 'MEXC',
    color: '#1972e2',
    available: true,
    blurb: 'Connect your MEXC futures account with trade-only API keys',
    hasTestnet: true,
  },
}

export const EXCHANGE_ORDER: ExchangeKind[] = ['binance', 'bybit', 'mexc']

/** The exchanges a user can actually connect today. */
export const AVAILABLE_EXCHANGES: ExchangeKind[] = EXCHANGE_ORDER.filter(
  (k) => EXCHANGE_META[k].available,
)

/** Rows from an API that predates the `exchange` column are Binance rows. */
export function exchangeOf(account: { exchange?: ExchangeKind | null }): ExchangeKind {
  return account.exchange ?? 'binance'
}
