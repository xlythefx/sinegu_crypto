/**
 * One change on Admin → Dashboard → Versions: what shipped, explained for the
 * owner and their employer first (no jargon), with the technical detail kept
 * for developers. Authored in code (`lib/adminVersions.ts`) by whoever ships
 * the feature, in the same change — see CLAUDE.md, "Versions page".
 */
export interface AdminChange {
  /** Stable slug, unique across the whole list. */
  id: string
  /** YYYY-MM-DD it went live. Changes are grouped into one version per day. */
  date: string
  kind: 'new' | 'improved' | 'fixed'
  /** Where it lives, in the owner's words ("Billing", "Signal Log", …) — the page's filter pills. */
  area: string
  title: string
  /** One or two plain sentences: what it does for you. Written for a non-technical reader. */
  summary: string
  /** How it works, step by step, still in plain language. */
  howItWorks: string[]
  /** Optional detail for developers (endpoints, tables, rules). Folded away by default. */
  technical?: string[]
  /** Where to see it. Internal paths open in the app. */
  links?: { label: string; href: string }[]
}
