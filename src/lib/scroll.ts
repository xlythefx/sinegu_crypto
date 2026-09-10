/**
 * Smooth-scroll to a section by id.
 *
 * Kept as a helper rather than an `<a href="#id">` because the landing CTAs are
 * <button>s and `index.css` sets no global `scroll-behavior`, so a bare anchor
 * would jump instantly. Honours the visitor's reduced-motion preference — a
 * long animated scroll is a common motion-sickness trigger.
 */
export const SECTION_IDS = {
  performance: 'performance',
} as const

export function scrollToSection(id: string): void {
  const target = document.getElementById(id)
  if (!target) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
}
