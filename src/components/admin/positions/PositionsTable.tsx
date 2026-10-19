import { Pencil, Trash2, XOctagon } from 'lucide-react'
import { displaySymbol } from '../../../lib/chart'
import { fmtDateTime, fmtMoney, fmtQty, fmtSignedMoney } from '../../../lib/format'
import type { PositionRow, PositionView, RowFeeSource } from '../../../lib/adminPositionRows'
import { Pill } from '../../ui/Pill'
import EntryExitCell from '../../positions/EntryExitCell'
import SideTag from '../../positions/SideTag'
import CloseSourceChip from './CloseSourceChip'
import DownsizeButton from './DownsizeButton'

// shared table primitives (mirrors the user Positions tables)
const TH_BASE =
  'py-[11px] px-3.5 text-[10.5px] font-bold tracking-[0.3px] uppercase text-faint whitespace-nowrap'
const TH = `${TH_BASE} text-left`
const TH_R = `${TH_BASE} text-right`
const TH_C = `${TH_BASE} text-center`
const TD = 'py-[11px] px-3.5 align-middle'
const TD_R = `${TD} text-right`
const TD_C = `${TD} text-center`
const ROW = 'border-t border-hair transition-colors hover:bg-surface2'

export const ICON_BTN =
  'inline-grid place-items-center w-8 h-8 border border-border rounded-[9px] bg-surface text-muted cursor-pointer transition-colors disabled:opacity-45 disabled:cursor-not-allowed enabled:hover:bg-surface2 enabled:hover:text-text'
const ICON_BTN_DANGER = `${ICON_BTN} enabled:hover:!border-[color-mix(in_srgb,var(--red)_40%,transparent)] enabled:hover:!bg-[color-mix(in_srgb,var(--red)_12%,transparent)] enabled:hover:!text-red`

const CLOSE_BTN =
  'inline-flex items-center gap-1 h-8 px-2.5 border border-[color-mix(in_srgb,var(--red)_40%,transparent)] rounded-[9px] bg-[color-mix(in_srgb,var(--red)_10%,transparent)] text-red text-[12px] font-bold cursor-pointer transition-colors disabled:opacity-45 disabled:cursor-not-allowed enabled:hover:bg-[color-mix(in_srgb,var(--red)_20%,transparent)]'

/** Coin-initials avatar + display symbol, with the direction of a single row. */
function TickerCell({ row, view }: { row: PositionRow; view: PositionView }) {
  const display = displaySymbol(row.symbol)
  const initials = display.split('/')[0].slice(0, 3)
  return (
    <div className="flex items-center gap-[9px] whitespace-nowrap">
      <span className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-[9px] bg-accent-soft border border-accent-line text-accent text-[9.5px] font-semibold flex-none font-mono">
        {initials}
      </span>
      <span className="flex flex-col gap-px">
        <span className="font-bold">{display}</span>
        {view === 'rows' && <SideTag side={row.direction} />}
      </span>
    </div>
  )
}

/** Position size in coins — the Signal Log's "Quantity" — on one line, with a
 *  yellow ↓ when a losing streak opened it smaller (click it for the details).
 *  A merged line shows the total size of every row it holds; its USDT value
 *  is on hover. */
function SizeCell({ row }: { row: PositionRow }) {
  if (row.qty == null || row.qty === 0) {
    return <span className="text-faint">—</span>
  }
  const coin = displaySymbol(row.symbol).split('/')[0].replace(/[^A-Z0-9]/gi, '')
  return (
    <span className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
      <span
        className="font-mono font-bold text-text"
        title={row.sizeValue != null ? `≈ ${fmtMoney(row.sizeValue)}` : undefined}
      >
        {fmtQty(Math.abs(row.qty), 0, 8)}{' '}
        <span className="text-[11px] font-semibold text-muted">{coin}</span>
      </span>
      {row.streak?.effect === 'smaller' && <DownsizeButton streak={row.streak} />}
    </span>
  )
}

/** P&L value + percentage of the account balance. */
function PnlCell({ pnl, balance }: { pnl: number; balance: number }) {
  const pos = pnl >= 0
  const pct = balance > 0 ? (pnl / balance) * 100 : null
  return (
    <div
      className={`inline-flex flex-col items-end gap-px ${pos ? 'text-green' : 'text-red'}`}
    >
      <span className="text-[13px] font-extrabold font-mono">{fmtSignedMoney(pnl)}</span>
      {pct !== null && (
        <span className="text-[11px] font-semibold font-mono opacity-85">
          {pos ? '+' : '−'}
          {Math.abs(pct).toFixed(2)}%
        </span>
      )}
    </div>
  )
}

/** Exchange fee already out of the P&L, with where it came from. The label is
 *  what the admin reads to know whether a figure can still move: `est.` and
 *  `manual` are pills (pending / hand-typed), `actual` and `mixed` plain. */
function FeeCell({ fee, source }: { fee: number | null; source: RowFeeSource }) {
  if (fee === null) {
    return <span className="text-faint">—</span>
  }
  const credit = fee < 0
  return (
    <div className="inline-flex flex-col items-end gap-px">
      <span className="text-[12.5px] font-mono">
        {credit ? '−' : ''}
        {fmtMoney(Math.abs(fee))}
      </span>
      {source === 'estimated' && (
        <Pill tone="muted" size="xs" title="Estimated until the exchange's receipts are matched">
          est.
        </Pill>
      )}
      {source === 'manual' && (
        <Pill tone="accent" size="xs" title="P&L typed by an admin; automatic fee updates stopped">
          manual
        </Pill>
      )}
      {(source === 'actual' || source === 'mixed') && (
        <span className="text-[10px] text-faint uppercase tracking-[0.05em]">{source}</span>
      )}
    </div>
  )
}

/** Merged-count pill; only emphasized when it actually merges >1 row. */
function CountPill({ count }: { count: number }) {
  return (
    <span
      className={`inline-grid place-items-center min-w-[26px] h-6 px-2 rounded-pill border font-mono text-xs font-bold ${
        count > 1
          ? 'bg-accent-soft border-accent-line text-accent'
          : 'bg-surface2 border-hair text-muted'
      }`}
    >
      {count}
    </span>
  )
}

interface Props {
  tab: 'active' | 'closed'
  view: PositionView
  rows: PositionRow[]
  onEdit: (row: PositionRow) => void
  onDelete: (row: PositionRow) => void
  /** Active tab: close this one position at market on the exchange. */
  onClose?: (row: PositionRow) => void
}

/** One table for both tabs and both views — the grouped view adds a merge
 *  count column; a single row's id stays in the action buttons' titles. */
export default function PositionsTable({
  tab,
  view,
  rows,
  onEdit,
  onDelete,
  onClose,
}: Props) {
  const closed = tab === 'closed'
  const grouped = view === 'grouped'
  const cols = (closed ? 10 : 7) + (grouped ? 1 : 0)
  // Editing writes to ONE database row, so a merged line has no single target.
  const canEdit = view === 'rows'

  return (
    <div className="mx-5 border border-hair rounded-row overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-surface2">
            <th className={TH}>Account</th>
            <th className={TH}>Ticker</th>
            <th className={TH}>Broker</th>
            {closed && <th className={TH}>Strategy</th>}
            <th className={TH_R}>Size</th>
            <th className={TH_R}>{closed ? 'Entry / Exit' : 'Entry / Now'}</th>
            <th className={TH_R}>{closed ? 'P&L' : 'Unrealized P&L'}</th>
            {closed && <th className={`${TH_R} max-[900px]:hidden`}>Fee</th>}
            {grouped && <th className={TH_C}>Count</th>}
            {closed && <th className={TH_R}>Closed At</th>}
            <th className={TH_R}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={cols} className="text-center text-muted py-[30px] px-3.5">
                No {closed ? 'past' : 'active'} positions found.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.key} className={ROW}>
                <td className={TD}>
                  <div className="flex flex-col">
                    <span className="font-bold">
                      {r.accountName ?? 'Unknown account'}
                    </span>
                    <span className="text-[11px] text-faint">
                      ID {r.accountId ?? '—'}
                    </span>
                  </div>
                </td>
                <td className={TD}>
                  <TickerCell row={r} view={view} />
                </td>
                <td className={TD}>
                  <span className="inline-block py-[3px] px-[9px] border border-border rounded-btn bg-surface2 text-[11.5px] font-semibold text-muted">
                    {r.broker}
                  </span>
                </td>
                {closed && (
                  <td className={`${TD} text-muted`}>{r.strategy ?? '—'}</td>
                )}
                <td className={TD_R}>
                  <SizeCell row={r} />
                </td>
                <td className={`${TD_R} font-mono`}>
                  <EntryExitCell
                    entry={r.entryPrice}
                    exit={r.price}
                    exitLabel={closed ? 'Out' : 'Now'}
                  />
                </td>
                <td className={TD_R}>
                  <PnlCell pnl={r.pnl} balance={r.accountBalance} />
                </td>
                {closed && (
                  <td className={`${TD_R} max-[900px]:hidden`}>
                    <FeeCell fee={r.fee} source={r.feeSource} />
                  </td>
                )}
                {grouped && (
                  <td className={TD_C}>
                    <CountPill count={r.count} />
                  </td>
                )}
                {closed && (
                  <td className={`${TD_R} text-muted font-mono`}>
                    {/* who closed it sits under WHEN it closed — the chip only
                        appears for a close made outside the bot */}
                    <div className="inline-flex flex-col items-end gap-1">
                      <span className="whitespace-nowrap">
                        {r.closedAt ? fmtDateTime(r.closedAt) : '—'}
                      </span>
                      <CloseSourceChip source={r.closeSource} />
                    </div>
                  </td>
                )}
                <td className={TD_R}>
                  <div className="inline-flex items-center gap-1.5">
                    {!closed && onClose && (
                      <button
                        type="button"
                        className={CLOSE_BTN}
                        disabled={!canEdit}
                        title={
                          canEdit
                            ? `Close ${displaySymbol(r.symbol)} at market on the exchange`
                            : 'Switch to "Per row" to close a single position'
                        }
                        onClick={() => onClose(r)}
                      >
                        <XOctagon size={13} />
                        Close
                      </button>
                    )}
                    <button
                      type="button"
                      className={ICON_BTN}
                      disabled={!canEdit}
                      title={
                        canEdit
                          ? `Edit ${closed ? 'trade' : 'position'} #${r.rowId}`
                          : 'Switch to "Per row" to edit a single row'
                      }
                      onClick={() => onEdit(r)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className={ICON_BTN_DANGER}
                      title={
                        canEdit
                          ? `Delete ${closed ? 'trade' : 'position'} #${r.rowId}`
                          : `Delete ${r.count} ${closed ? 'trade' : 'position'}${r.count > 1 ? 's' : ''}`
                      }
                      onClick={() => onDelete(r)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
