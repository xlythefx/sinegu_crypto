import { useState } from 'react'
import { Braces } from 'lucide-react'
import CopyState from '../../ui/CopyState'

interface JsonPanelProps {
  title: string
  hint: string
  value: unknown
  /** Shown instead of the JSON when there is nothing yet. */
  empty?: string
}

/**
 * A titled, copyable JSON block — the open-positions page shows the exact
 * request it will send and the exact answer it got, so a test run can be read
 * (and pasted into a bug report) without opening the network tab.
 */
export default function JsonPanel({ title, hint, value, empty }: JsonPanelProps) {
  const [copied, setCopied] = useState(false)
  const hasValue = value !== null && value !== undefined
  const json = hasValue ? JSON.stringify(value, null, 2) : ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* Clipboard blocked — the <pre> is selectable, nothing to recover. */
    }
  }

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-row border border-border bg-surface2">
      <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
        <Braces size={14} className="flex-none text-accent" />
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-bold text-text">{title}</div>
          <div className="truncate text-[11.5px] text-muted">{hint}</div>
        </div>
        {hasValue && (
          <button
            type="button"
            onClick={copy}
            className="inline-flex flex-none cursor-pointer items-center gap-1 rounded-btn border border-border bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-muted hover:text-text"
          >
            <CopyState copied={copied} size={12} checkClassName="text-green" />
          </button>
        )}
      </div>
      {hasValue ? (
        <pre className="m-0 max-h-[340px] overflow-auto p-3.5 font-mono text-[11.5px] leading-[1.55] text-text">
          {json}
        </pre>
      ) : (
        <div className="px-3.5 py-6 text-center text-[12.5px] text-muted">{empty ?? 'Nothing yet.'}</div>
      )}
    </div>
  )
}
