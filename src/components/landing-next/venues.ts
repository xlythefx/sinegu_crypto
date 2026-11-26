import { EXCHANGE_META, EXCHANGE_ORDER } from '../exchanges/meta'
import type { ExchangeKind } from '../../types/exchanges'

export interface Venue {
  kind: ExchangeKind
  label: string
  /** A customer may connect it TODAY: available and not staff-only — the
   *  connect page's own switch (meta.ts), so opening a venue there opens it
   *  on the home page too, with nobody editing this page's text. */
  open: boolean
}

/** Every exchange the product supports, in the house order. */
export const VENUES: Venue[] = EXCHANGE_ORDER.map((kind) => ({
  kind,
  label: EXCHANGE_META[kind].label,
  open: EXCHANGE_META[kind].available && !EXCHANGE_META[kind].staffOnly,
}))

/** "Binance" · "Bybit and MEXC" · "Binance, Bybit and MEXC". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** "Bybit and MEXC are coming soon." — empty once every venue is open. */
export function comingSoonSentence(): string {
  const soon = VENUES.filter((v) => !v.open).map((v) => v.label)
  if (soon.length === 0) return ''
  return `${joinNames(soon)} ${soon.length === 1 ? 'is' : 'are'} coming soon.`
}
