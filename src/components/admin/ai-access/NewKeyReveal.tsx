import { ShieldAlert } from 'lucide-react'
import CopyButton from '../webhooks/CopyButton'

interface NewKeyRevealProps {
  name: string
  plainKey: string
  onDone: () => void
}

/**
 * The one time a key is ever visible. The server keeps only its fingerprint,
 * so once this panel is closed the key cannot be shown again — a lost key is
 * revoked and replaced, never recovered.
 */
export default function NewKeyReveal({ name, plainKey, onDone }: NewKeyRevealProps) {
  return (
    <div
      className="flex min-w-0 flex-col gap-3 rounded-row border border-accent-line bg-[linear-gradient(160deg,var(--accentSoft),var(--surface))] p-4 animate-[fadeup_0.35s_ease-out]"
      role="status"
    >
      <div className="flex items-start gap-2.5">
        <ShieldAlert size={18} className="mt-px flex-none text-accent" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[13.5px] font-bold text-text">“{name}” is ready — copy it now</p>
          <p className="mt-0.5 text-[12.5px] leading-[1.55] text-muted">
            This is the only time it is shown. Paste it into the connector’s HTTP header <em>Value</em>. Anyone holding
            it can read every trade, account and invoice, so send it only to the person who will use it.
          </p>
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-2 rounded-row border border-border bg-surface py-1.5 pl-3 pr-1.5">
        <code className="min-w-0 flex-1 break-all py-1 font-mono text-[12.5px] leading-[1.45] text-text">{plainKey}</code>
        <CopyButton text={plainKey} variant="primary" ariaLabel="Copy the new key" />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onDone}
          className="inline-flex h-8 cursor-pointer items-center rounded-field border border-border bg-surface px-3 text-[12px] font-bold text-text transition-[border-color] duration-150 hover:border-accent-line"
        >
          I’ve copied it
        </button>
      </div>
    </div>
  )
}
