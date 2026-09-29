import { Check, Copy } from 'lucide-react'

interface CopyStateProps {
  copied: boolean
  size?: number
  label?: string
  copiedLabel?: string
  /** Extra class on the Check icon (e.g. `text-green`). */
  checkClassName?: string
}

/**
 * The icon + label inside a copy button, swapped on `copied`.
 *
 * Each half sits in its own element on purpose. Browser translators (Chrome's
 * auto-translate) replace a bare text node with a `<font>` wrapper; when the
 * icon then swapped beside it, React inserted the new icon before a text node
 * that was no longer in the button, threw, and unmounted the whole app — a
 * black screen on "Copy". Inside its own span the icon has no sibling to
 * anchor on, and `translate="no"` keeps the label a plain text node.
 */
export default function CopyState({
  copied,
  size = 13,
  label = 'Copy',
  copiedLabel = 'Copied',
  checkClassName,
}: CopyStateProps) {
  return (
    <>
      <span className="inline-flex" aria-hidden="true">
        {copied ? <Check size={size} className={checkClassName} /> : <Copy size={size} />}
      </span>
      <span translate="no">{copied ? copiedLabel : label}</span>
    </>
  )
}
