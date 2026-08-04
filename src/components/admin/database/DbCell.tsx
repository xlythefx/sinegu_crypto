import { Binary, Lock } from 'lucide-react'
import type { DbValue } from '../../../types/admin'
import { cellKind, cellText } from '../../../lib/dbCells'
import { TD } from './classes'

/** Longer than this and the cell truncates, with the full value one click away. */
const TRUNCATE_AT = 64

interface DbCellProps {
  column: string
  value: DbValue
  masked: string[]
  binary: string[]
  onExpand: (column: string, value: string) => void
}

/**
 * One grid cell. NULL, '' and hidden values each render distinctly — showing
 * all three as blank space is how a DB browser lies to you. Truncation is
 * display-only; the underlying value is never altered.
 */
export default function DbCell({
  column,
  value,
  masked,
  binary,
  onExpand,
}: DbCellProps) {
  const kind = cellKind(value, column, masked, binary)

  if (kind === 'null') {
    return (
      <td className={TD}>
        <span className="text-faint italic">NULL</span>
      </td>
    )
  }

  if (kind === 'empty') {
    return (
      <td className={TD}>
        <span className="text-faint">∅ empty</span>
      </td>
    )
  }

  if (kind === 'masked') {
    return (
      <td className={TD}>
        <span
          className="inline-flex items-center gap-1.5 text-faint font-mono"
          title="Hidden for safety — the real value never leaves the server"
        >
          <Lock size={12} />
          {cellText(value)}
        </span>
      </td>
    )
  }

  const text = cellText(value)

  if (kind === 'binary') {
    return (
      <td className={TD}>
        <span
          className="inline-flex items-center gap-1.5 text-faint font-mono text-[12px]"
          title="Binary data — shown as hex, read-only"
        >
          <Binary size={12} />
          {text.length > 24 ? `${text.slice(0, 24)}…` : text}
        </span>
      </td>
    )
  }

  const isLong = text.length > TRUNCATE_AT

  return (
    <td className={TD}>
      {isLong ? (
        <button
          type="button"
          className="max-w-[280px] truncate block text-left bg-transparent border-0 p-0 text-[13px] text-text cursor-pointer hover:text-accent"
          title="Click to see the full value"
          onClick={() => onExpand(column, text)}
        >
          {text}
        </button>
      ) : (
        <span className="whitespace-nowrap">{text}</span>
      )}
    </td>
  )
}
