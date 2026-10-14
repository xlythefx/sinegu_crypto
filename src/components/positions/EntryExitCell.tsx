import { fmtMoney } from '../../lib/format'

const LABEL = 'text-faint text-[10px] uppercase tracking-[0.05em] mr-1.5'

/** Entry first, then where it went: the exit of a closed trade ("Out") or the
 *  current mark of an open position ("Now"). An unrecorded price reads "—",
 *  never $0. Shared by the trader's Positions page and the admin tables. */
export default function EntryExitCell({
  entry,
  exit,
  exitLabel = 'Out',
  align = 'end',
}: {
  entry: number | null
  exit: number | null
  exitLabel?: string
  /** `end` in the admin's right-aligned column, `start` on the trader's page. */
  align?: 'start' | 'end'
}) {
  return (
    <div
      className={`inline-flex flex-col gap-px font-mono whitespace-nowrap ${
        align === 'end' ? 'items-end' : 'items-start'
      }`}
    >
      <span className="text-[12.5px]">
        <span className={LABEL}>In</span>
        {entry === null ? <span className="text-faint">—</span> : fmtMoney(entry)}
      </span>
      <span className="text-[12.5px]">
        <span className={LABEL}>{exitLabel}</span>
        {exit === null ? <span className="text-faint">—</span> : fmtMoney(exit)}
      </span>
    </div>
  )
}
