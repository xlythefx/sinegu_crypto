import { canSeeAdmin } from '../../lib/roles'
import type { UserRole } from '../../types/auth'
import type { ExchangeKind } from '../../types/exchanges'

export interface ExchangeMeta {
  label: string
  /** Brand color (matches the dots used in the top-bar filter). */
  color: string
  available: boolean
  blurb: string
  /**
   * Whether the venue has a non-live environment the engine can route a demo
   * account to (Binance: testnet.binancefuture.com; MEXC:
   * futures.testnet.mexc.com; Bybit: Demo Trading at api-demo.bybit.com).
   * Without one the wizard skips the live/demo step and the API refuses
   * `demo: true` — a "demo" row on such a venue could only ever be a live
   * account wearing the wrong badge.
   */
  hasTestnet: boolean
  /**
   * Live in the engine, but not yet offered to customers: only staff
   * (`canSeeAdmin`) may CONNECT one. MEXC and Bybit are both that today —
   * they trade, they just have not run long enough on a real customer
   * account to sell.
   *
   * Client twin of the API's `config('exchanges.staff_only')`, which is the
   * real enforcement (`EXCHANGE_RESTRICTED`, 403). This one only decides what
   * the wizard offers, and a customer is shown the same "Coming soon" a venue
   * without tables gets — for them that is the whole truth.
   *
   * Connecting only. An account already on the venue keeps trading and can
   * always be renamed or disconnected; restricting a venue must never trap
   * someone's keys inside it.
   */
  staffOnly: boolean
}

export const EXCHANGE_META: Record<ExchangeKind, ExchangeMeta> = {
  binance: {
    label: 'Binance',
    color: '#f0b90b',
    available: true,
    blurb: 'Connect your Binance account with trade-only API keys',
    hasTestnet: true,
    staffOnly: false,
  },
  bybit: {
    label: 'Bybit',
    color: '#f7a600',
    available: true,
    blurb: 'Connect your Bybit USDT perpetuals account with trade-only API keys',
    hasTestnet: true,
    staffOnly: true,
  },
  mexc: {
    label: 'MEXC',
    color: '#1972e2',
    available: true,
    blurb: 'Connect your MEXC futures account with trade-only API keys',
    hasTestnet: true,
    staffOnly: true,
  },
}

export const EXCHANGE_ORDER: ExchangeKind[] = ['binance', 'bybit', 'mexc']

/** The exchanges that are wired at all — before any per-user restriction. */
export const AVAILABLE_EXCHANGES: ExchangeKind[] = EXCHANGE_ORDER.filter(
  (k) => EXCHANGE_META[k].available,
)

/** Whether THIS user may connect a new account on this venue. */
export function canConnectExchange(
  kind: ExchangeKind,
  role: UserRole | undefined,
): boolean {
  const meta = EXCHANGE_META[kind]
  return meta.available && (!meta.staffOnly || canSeeAdmin(role))
}

/** The venues the connect wizard may offer this user, in display order. */
export function connectableExchanges(role: UserRole | undefined): ExchangeKind[] {
  return AVAILABLE_EXCHANGES.filter((k) => canConnectExchange(k, role))
}

/** Rows from an API that predates the `exchange` column are Binance rows. */
export function exchangeOf(account: { exchange?: ExchangeKind | null }): ExchangeKind {
  return account.exchange ?? 'binance'
}
