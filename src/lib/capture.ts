/**
 * Pure helpers for the card screenshot (`components/ui/Capturable.tsx`).
 */

/** "Performance Analytics" -> "performance-analytics"; never empty. */
export function slugify(text: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'card'
}

/** The reader's LOCAL calendar date as YYYY-MM-DD (the day they took it). */
export function localIsoDate(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** `pixel-alpha-{subject}-{card}-{yyyy-mm-dd}.png` */
export function captureFileName(subject: string, card: string, date: Date = new Date()): string {
  return `pixel-alpha-${slugify(subject)}-${slugify(card)}-${localIsoDate(date)}.png`
}
