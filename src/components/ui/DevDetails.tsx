import { useState } from 'react'
import { ChevronRight, TerminalSquare } from 'lucide-react'
import CopyState from './CopyState'
import type { ApiErrorDebug } from '../../services/api'

interface DevDetailsProps {
  /** What this panel explains, e.g. "Crypto deposit failed". */
  title: string
  debug: ApiErrorDebug
  /** Open on first render — use for the failure the user is staring at. */
  defaultOpen?: boolean
  /** Outer spacing; clear it inside a gap-spaced flex column. */
  className?: string
}

/**
 * Developer-only diagnostic panel: the status, the error code, the API's hint
 * and its whole `debug` block, copyable in one click.
 *
 * Render it ONLY behind `isDeveloper(user.type)`. Traders must keep seeing the
 * single friendly sentence — this exists so a developer hitting the same fault
 * on the same box does not have to go read the Laravel log to learn which of
 * "unreachable / bad keys / no wallet / rejected" actually happened.
 *
 * The server is the other half of the gate: `PaymentController` only attaches
 * `debug` for `developer` accounts, so on a normal session there is nothing
 * here to leak in the first place.
 */
export default function DevDetails({
  title,
  debug,
  defaultOpen = true,
  className = 'mt-2.5',
}: DevDetailsProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [copied, setCopied] = useState(false)

  const json = JSON.stringify(
    { status: debug.status, error_code: debug.errorCode, message: debug.message, detail: debug.detail },
    null,
    2,
  )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* Clipboard blocked (http origin, denied permission) — the text is
         selectable in the <pre> below, so there is nothing to recover from. */
    }
  }

  return (
    <div className={`${className} rounded-[12px] border border-dashed border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--accent)_7%,transparent)] overflow-hidden`}>
      <div className="flex items-center gap-2 p-2.5 max-[420px]:p-2">
        <button
          type="button"
          className="flex-1 min-w-0 flex items-center gap-2 text-left bg-transparent border-0 p-0 cursor-pointer text-accent"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <TerminalSquare size={14} className="flex-shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] truncate">
            Dev · {title}
          </span>
          <span className="font-mono text-[10.5px] text-faint flex-shrink-0">
            {debug.status || 'net'}
            {debug.errorCode ? ` · ${debug.errorCode}` : ''}
          </span>
          <ChevronRight
            size={14}
            className={`flex-shrink-0 ml-auto transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          />
        </button>
        <button
          type="button"
          className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-btn border border-border bg-surface py-1 px-2 text-[11px] font-bold text-text cursor-pointer transition-[border-color] duration-150 hover:border-accent"
          onClick={copy}
          aria-label="Copy diagnostic JSON"
        >
          <CopyState copied={copied} size={12} />
        </button>
      </div>

      {open && (
        <div className="px-2.5 pb-2.5 max-[420px]:px-2 max-[420px]:pb-2 flex flex-col gap-2">
          <p className="text-[11.5px] text-text leading-[1.5] font-mono break-words">
            {debug.message}
          </p>
          {debug.hint && (
            <p className="text-[11.5px] text-muted leading-[1.5] border-l-2 border-accent pl-2.5">
              {debug.hint}
            </p>
          )}
          {debug.detail !== undefined && (
            <pre className="max-h-[260px] overflow-auto rounded-[8px] border border-hair bg-surface2 p-2.5 font-mono text-[10.5px] leading-[1.55] text-muted whitespace-pre">
              {JSON.stringify(debug.detail, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
