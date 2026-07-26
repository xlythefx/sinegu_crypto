import type { ExchangeKind } from '../../types/exchanges'

export interface ExchangeMeta {
  label: string
  /** Brand color (matches the dots used in the top-bar filter). */
  color: string
  available: boolean
  blurb: string
}

export const EXCHANGE_META: Record<ExchangeKind, ExchangeMeta> = {
  binance: {
    label: 'Binance',
    color: '#f0b90b',
    available: true,
    blurb: 'Connect your Binance account with trade-only API keys',
  },
  bybit: {
    label: 'Bybit',
    color: '#f7a600',
    available: false,
    blurb: 'Connect your Bybit account with trade-only API keys',
  },
  mexc: {
    label: 'MEXC',
    color: '#1972e2',
    available: false,
    blurb: 'Connect your MEXC account with trade-only API keys',
  },
}

export const EXCHANGE_ORDER: ExchangeKind[] = ['binance', 'bybit', 'mexc']
