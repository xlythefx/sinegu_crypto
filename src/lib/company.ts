/**
 * Who Pixel Alpha is, in the form every page prints it.
 *
 * One source of truth: the name, address and support channels are read from
 * here by every invoice, legal page and footer, never retyped per screen. If
 * any of this changes, it changes here and every rendered/printed surface
 * follows.
 *
 * **Pixel Alpha is the ONLY name a customer ever sees** (2026-09-20). The
 * billing entity that used to be printed beside it — its legal name, registry
 * number and registered address — was removed from every user-visible
 * surface, invoices included, at the owner's request. Do not reintroduce a
 * second name here: a `legalName` field is exactly what put it on six lines of
 * the Privacy Policy.
 */
export const COMPANY = {
  name: 'Pixel Alpha',
  email: 'support@pixel-alpha.com',
  /** Support Telegram handle, WITHOUT the "@" — see `SUPPORT_TELEGRAM_URL`. */
  telegram: 'pixel_alpha_support',
  website: 'pixel-alpha.com',
} as const

/**
 * Where a person can find Pixel Alpha — the Bangkok office (2026-09-18). It is
 * the one postal address the product publishes: the Contact page, the legal
 * pages' controller and contact blocks, and the invoice's FROM block all read
 * it from here.
 */
export const OFFICE = {
  name: COMPANY.name,
  label: 'Office (Bangkok)',
  /** Rendered one line per entry. */
  addressLines: [
    'Park Ventures Ecoplex, 57 Witthayu Rd',
    'Lumphini, Pathum Wan, Bangkok 10330',
  ],
  /** Country on its own, for legal text that names the jurisdiction. */
  country: 'Thailand',
  hours: 'Mon–Fri 9:00–18:00 (ICT, Bangkok time)',
} as const

/**
 * The two support channels, in the form every page prints them. Anything that
 * tells a customer where to write (legal contact sections, footers, error
 * states) reads these rather than retyping the address or handle. There is no
 * personal line beside them (removed 2026-09-18): a contact is a desk, not a
 * person, so the address outlives whoever holds it.
 */
export const SUPPORT_EMAIL = COMPANY.email
export const SUPPORT_TELEGRAM_HANDLE = `@${COMPANY.telegram}`
export const SUPPORT_TELEGRAM_URL = `https://t.me/${COMPANY.telegram}`

/**
 * Where to FOLLOW Pixel Alpha (2026-09-21) — the public channels, as opposed
 * to the support desk above. The footers render these as icon links, in this
 * order. Telegram here is the public signals channel (every entry, exit and
 * recap is announced there), Discord mirrors the same messages, X is the
 * brand account. None of these is a support contact: a customer with a
 * problem is sent to `SUPPORT_*`, never to a channel.
 */
export type SocialId = 'telegram' | 'x' | 'discord'

export const SOCIAL_LINKS: { id: SocialId; label: string; href: string }[] = [
  { id: 'telegram', label: 'Telegram', href: 'https://t.me/voltraxtrades' },
  { id: 'x', label: 'X', href: 'https://x.com/thepixelalpha' },
  { id: 'discord', label: 'Discord', href: 'https://discord.gg/eBKfvtu9HE' },
]

/**
 * VAT charged on performance fees. Kept as a number (not a string) so the
 * document can compute the line rather than hardcode "$0.00" — the day a rate
 * applies, only this constant and the note below change.
 */
export const VAT_RATE = 0
