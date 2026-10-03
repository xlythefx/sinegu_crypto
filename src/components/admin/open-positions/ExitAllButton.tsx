import { XOctagon } from 'lucide-react'

interface ExitAllButtonProps {
  /** Closable positions it would close; nothing to close renders nothing. */
  count: number
  disabled?: boolean
  onClick: () => void
}

/**
 * One account's "close everything" — opens the confirm dialog with every
 * closable position of that account, no ticking first.
 */
export default function ExitAllButton({ count, disabled, onClick }: ExitAllButtonProps) {
  if (count === 0) return null
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex flex-none cursor-pointer items-center gap-1.5 rounded-pill border border-red/40 bg-red/10 px-3 py-1.5 text-[12px] font-bold text-red transition-colors hover:bg-red/20 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <XOctagon size={13} />
      Exit all ({count})
    </button>
  )
}
