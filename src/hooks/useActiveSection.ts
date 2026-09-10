import { useEffect, useState } from 'react'

/**
 * Reports which section of a long document is currently being read, so a table
 * of contents can highlight it.
 *
 * This is deliberately NOT the AOS scroll-reveal pattern (that stays AOS) — it
 * is a scroll-spy: it watches a band under the sticky header and reports the
 * first section inside it, keeping the last answer while the reader is between
 * two headings.
 */
export function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null)

  useEffect(() => {
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)
    if (elements.length === 0) return

    const visible = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id)
          else visible.delete(entry.target.id)
        }
        const first = ids.find((id) => visible.has(id))
        if (first) setActive(first)
      },
      // Top band only: a heading counts as "current" once it passes under the
      // header and until the next one reaches the same line.
      { rootMargin: '-96px 0px -68% 0px', threshold: 0 },
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [ids])

  return active
}
