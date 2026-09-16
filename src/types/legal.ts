/**
 * Shape of a legal document (Terms, and later Privacy / Risk Disclaimer).
 *
 * The text lives as DATA, not JSX, for one reason: a legal document is edited
 * by whoever owns the wording, and they must be able to change a clause without
 * touching a component. The renderer
 * (`components/legal/LegalDocument.tsx`) knows how each block looks; the
 * content file knows what it says.
 */

export type LegalBlock =
  /** A paragraph of body copy. */
  | { kind: 'p'; text: string }
  /** A numbered or named sub-heading inside a section (e.g. "3.1 Account Creation"). */
  | { kind: 'h3'; text: string }
  /** A bulleted list. */
  | { kind: 'list'; items: string[] }
  /** A highlighted callout — used sparingly, for the clauses that carry risk. */
  | { kind: 'note'; text: string }
  /** A contact line rendered as a real mailto link. */
  | { kind: 'email'; label: string; address: string }
  /** A contact line rendered as a t.me link; `handle` is given without the "@". */
  | { kind: 'telegram'; label: string; handle: string }

export interface LegalSection {
  /** Anchor id — also the `#hash` the table of contents links to. */
  id: string
  /** Display number shown beside the heading ("01" … "19"). */
  number: string
  title: string
  blocks: LegalBlock[]
}

export interface LegalDocumentContent {
  title: string
  /** Human-readable date, already formatted — never a raw ISO string. */
  updatedAt: string
  /** The paragraph above the table of contents. */
  lede: string
  sections: LegalSection[]
  /** Closing statement rendered in its own card below the last section. */
  acknowledgment: string
}
