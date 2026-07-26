/** Pure validators — no React. */

/** Affiliate/profit payouts support USDT on the Tron network only. */
export const USDT_TRC20_NETWORK = 'TRC20' as const

/** Tron TRC20 address: starts with T, 34 chars, base58 alphabet. */
const TRC20_ADDRESS_REGEX = /^T[1-9A-HJ-NP-Za-km-z]{33}$/

export function isValidTRC20Address(address: string): boolean {
  const trimmed = address.trim()
  return trimmed.length === 34 && TRC20_ADDRESS_REGEX.test(trimmed)
}
