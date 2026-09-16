/**
 * The legal entity behind Pixel Alpha — the issuer printed on every invoice.
 *
 * One source of truth: an invoice is a legal document, so the registry number,
 * address and trading name must never be retyped per screen. If any of this
 * changes, it changes here and every rendered/printed invoice follows.
 *
 * `Pixel Alpha` is the product/trading name; `Feature Digital LTD` is the
 * company that bills. Both belong on the document.
 */
export const COMPANY = {
  legalName: 'Feature Digital LTD',
  tradingName: 'Pixel Alpha',
  registryNumber: '516203072',
  /** Rendered one line per entry in the FROM block. */
  addressLines: ['Lilinblum 26', 'Gedera 7070000', 'Israel'],
  email: 'support@pixel-alpha.com',
  /** Support Telegram handle, WITHOUT the "@" — see `SUPPORT_TELEGRAM_URL`. */
  telegram: 'pixel_alpha_support',
  website: 'pixel-alpha.com',
} as const

/**
 * The two support channels, in the form every page prints them. Anything that
 * tells a customer where to write (legal contact sections, footers, error
 * states) reads these rather than retyping the address or handle.
 */
export const SUPPORT_EMAIL = COMPANY.email
export const SUPPORT_TELEGRAM_HANDLE = `@${COMPANY.telegram}`
export const SUPPORT_TELEGRAM_URL = `https://t.me/${COMPANY.telegram}`

/**
 * VAT charged on performance fees. Kept as a number (not a string) so the
 * document can compute the line rather than hardcode "$0.00" — the day a rate
 * applies, only this constant and the note below change.
 */
export const VAT_RATE = 0
