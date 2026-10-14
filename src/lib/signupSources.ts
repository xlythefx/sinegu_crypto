/**
 * "Where did you hear about us?" — the nine tiles of the sign-up form's 3×3
 * grid, in grid order. The slugs are the API's keys
 * (`App\Services\Signup\SignupSources::SLUGS`) and are stored one row per
 * ticked tile for the statistics to come — never rename one once shipped;
 * relabel instead. `other` is always last: ticking it opens a text box.
 */

export type SignupSource =
  | 'discord'
  | 'telegram'
  | 'ai'
  | 'friend'
  | 'youtube'
  | 'x'
  | 'google'
  | 'social'
  | 'other'

export interface SignupSourceOption {
  slug: SignupSource
  label: string
  /** Small second line under the label, where the label alone is ambiguous. */
  hint?: string
}

export const SIGNUP_SOURCES: readonly SignupSourceOption[] = [
  { slug: 'discord', label: 'Discord server' },
  { slug: 'telegram', label: 'Telegram' },
  { slug: 'ai', label: 'AI chatbot', hint: 'ChatGPT, Claude…' },
  { slug: 'friend', label: 'Friend / referral' },
  { slug: 'youtube', label: 'YouTube' },
  { slug: 'x', label: 'X (Twitter)' },
  { slug: 'google', label: 'Google search' },
  { slug: 'social', label: 'TikTok / Instagram' },
  { slug: 'other', label: 'Other' },
]

export const SIGNUP_SOURCE_LABELS: Record<SignupSource, string> = Object.fromEntries(
  SIGNUP_SOURCES.map((s) => [s.slug, s.label]),
) as Record<SignupSource, string>

/** Max length of the "Other" text — the API column is 120. */
export const SIGNUP_SOURCE_OTHER_MAX = 120

/**
 * Client twin of the API's handle normalisation, so the field shows what will
 * be stored. The API normalises again and is the one that refuses.
 */
export function normaliseTelegram(raw: string): string {
  return raw
    .trim()
    .replace(/^(https?:\/\/)?t\.me\//i, '')
    .replace(/^@/, '')
}

export function normaliseDiscord(raw: string): string {
  return raw.trim().replace(/^@/, '').toLowerCase()
}

export const TELEGRAM_PATTERN = /^[A-Za-z][A-Za-z0-9_]{3,31}$/
export const DISCORD_PATTERN = /^[a-z0-9_.]{2,32}$/

export const TELEGRAM_HINT = 'Telegram usernames are 4–32 letters, numbers or underscores, e.g. @pixel_alpha.'
export const DISCORD_HINT = 'Discord usernames are 2–32 lowercase letters, numbers, dots or underscores.'

/** First problem with the typed handles, or null. Empty fields are fine — both are optional. */
export function handleError(telegram: string, discord: string | null): string | null {
  const tg = normaliseTelegram(telegram)
  if (tg && !TELEGRAM_PATTERN.test(tg)) return TELEGRAM_HINT
  if (discord !== null) {
    const dc = normaliseDiscord(discord)
    if (dc && !DISCORD_PATTERN.test(dc)) return DISCORD_HINT
  }
  return null
}

/** The optional answers the register form (and the Discord sign-up step) collects. */
export interface SignupExtras {
  heardFrom: SignupSource[]
  heardFromOther: string
  telegram: string
  /** Absent on a Discord sign-up — the linked username is already known. */
  discord?: string
}

/** Request body fragment for {@link SignupExtras}; blank answers are left out. */
export function signupExtrasPayload(extras: SignupExtras): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (extras.heardFrom.length) {
    // Grid order, so the stored rows read the way the form showed them.
    body.heard_from = SIGNUP_SOURCES.map((s) => s.slug).filter((s) => extras.heardFrom.includes(s))
    const other = extras.heardFromOther.trim()
    if (extras.heardFrom.includes('other') && other) body.heard_from_other = other
  }
  const telegram = normaliseTelegram(extras.telegram)
  if (telegram) body.telegram = telegram
  if (extras.discord !== undefined) {
    const discord = normaliseDiscord(extras.discord)
    if (discord) body.discord = discord
  }
  return body
}

/** `https://t.me/<handle>` for a stored Telegram username. */
export function telegramUrl(handle: string): string {
  return `https://t.me/${handle}`
}
