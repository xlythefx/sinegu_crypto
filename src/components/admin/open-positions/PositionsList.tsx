import { Ban } from 'lucide-react'
import { EXCHANGE_META } from '../../exchanges/meta'
import { fmtAgo, fmtNum, fmtQty, fmtSignedMoney } from '../../../lib/format'
import { positionKey } from '../../../lib/openPositions'
import type { AdminOpenPosition } from '../../../types/openPositions'

interface PositionsListProps {
  positions: AdminOpenPosition[]
  selected: Set<string>
  onToggle: (key: string) => void
  onToggleAll: () => void
  /** False where every row has the same owner (master view, one user expanded). */
  showOwner?: boolean
}

const TH = 'px-3 py-2.5 text-left font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-faint'
const TD = 'px-3 py-3 align-middle'
const CHECK = 'h-4 w-4 cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40'

const price = (n: number | null) => (n === null ? '—' : fmtNum(n, n < 10 ? 4 : 2))
const pnlClass = (n: number | null) => (n === null ? 'text-muted' : n > 0 ? 'text-green' : n < 0 ? 'text-red' : 'text-text')

function SidePill({ side }: { side: 'LONG' | 'SHORT' }) {
  return (
    <span
      className={`inline-flex rounded-pill px-2 py-0.5 font-mono text-[10.5px] font-bold ${
        side === 'LONG' ? 'bg-green/15 text-green' : 'bg-red/15 text-red'
      }`}
    >
      {side}
    </span>
  )
}

function Who({ p, showOwner }: { p: AdminOpenPosition; showOwner: boolean }) {
  const meta = EXCHANGE_META[p.exchange]
  return (
    <div className="min-w-0">
      <div className={`items-center gap-1.5 ${showOwner ? 'flex' : 'hidden'}`}>
        <span className="truncate text-[13px] font-semibold text-text">{p.owner_name}</span>
        {p.owner_type === 'master' && (
          <span className="flex-none rounded-pill bg-accent-soft px-1.5 font-mono text-[10px] font-bold text-accent">MASTER</span>
        )}
        {p.demo && (
          <span className="flex-none rounded-pill bg-surface2 px-1.5 font-mono text-[10px] font-bold text-muted">DEMO</span>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-[11.5px] text-muted">
        <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: meta?.color }} />
        <span className="truncate">
          {meta?.label ?? p.exchange}
          {p.account_name ? ` · ${p.account_name}` : ''}
        </span>
      </div>
    </div>
  )
}

function Blocked({ reason }: { reason: string | null }) {
  return (
    <div className="mt-1 flex items-start gap-1 text-[11.5px] text-red">
      <Ban size={12} className="mt-px flex-none" />
      <span>{reason ?? 'The engine cannot close this.'}</span>
    </div>
  )
}

/**
 * The open positions as a table on desktop and as cards on a phone. A row the
 * engine cannot close keeps its checkbox disabled and says why on the row
 * itself, so nobody ticks it and wonders why nothing happened.
 */
export default function PositionsList({ positions, selected, onToggle, onToggleAll, showOwner = true }: PositionsListProps) {
  const closable = positions.filter((p) => p.closable)
  const allOn = closable.length > 0 && closable.every((p) => selected.has(positionKey(p)))

  return (
    <>
      <div className="overflow-x-auto rounded-row border border-border max-[760px]:hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead className="bg-surface2">
            <tr>
              <th className={`${TH} w-10`}>
                <input
                  type="checkbox"
                  className={CHECK}
                  checked={allOn}
                  disabled={closable.length === 0}
                  onChange={onToggleAll}
                  aria-label="Select every closable position"
                />
              </th>
              <th className={TH}>{showOwner ? 'User · account' : 'Account'}</th>
              <th className={TH}>Coin</th>
              <th className={TH}>Side</th>
              <th className={`${TH} text-right`}>Size</th>
              <th className={`${TH} text-right`}>Entry</th>
              <th className={`${TH} text-right`}>Mark</th>
              <th className={`${TH} text-right`}>Unrealized P&amp;L</th>
              <th className={`${TH} text-right`}>Updated</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const key = positionKey(p)
              const on = selected.has(key)
              return (
                <tr
                  key={key}
                  onClick={() => p.closable && onToggle(key)}
                  className={`border-t border-border transition-colors ${
                    p.closable ? 'cursor-pointer hover:bg-surface2' : 'opacity-75'
                  } ${on ? 'bg-accent-soft' : ''}`}
                >
                  <td className={TD} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className={CHECK}
                      checked={on}
                      disabled={!p.closable}
                      onChange={() => onToggle(key)}
                      aria-label={`Select ${p.owner_name} ${p.symbol} ${p.side}`}
                    />
                  </td>
                  <td className={TD}>
                    <Who p={p} showOwner={showOwner} />
                    {!p.closable && <Blocked reason={p.blocked_reason} />}
                  </td>
                  <td className={`${TD} font-mono font-bold`}>{p.symbol}</td>
                  <td className={TD}><SidePill side={p.side} /></td>
                  <td className={`${TD} text-right font-mono`}>{fmtQty(p.size)}</td>
                  <td className={`${TD} text-right font-mono text-muted`}>{price(p.entry_price)}</td>
                  <td className={`${TD} text-right font-mono`}>{price(p.mark_price)}</td>
                  <td className={`${TD} text-right font-mono font-bold ${pnlClass(p.unrealized_pnl)}`}>
                    {p.unrealized_pnl === null ? '—' : fmtSignedMoney(p.unrealized_pnl)}
                  </td>
                  <td className={`${TD} whitespace-nowrap text-right text-[12px] text-muted`}>{fmtAgo(p.updated_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Phone: one card per position, the whole card is the tap target. */}
      <div className="hidden flex-col gap-2.5 max-[760px]:flex">
        <label className="flex cursor-pointer items-center gap-2.5 px-1 text-[12.5px] font-semibold text-muted">
          <input type="checkbox" className={CHECK} checked={allOn} disabled={closable.length === 0} onChange={onToggleAll} />
          Select every closable position
        </label>
        {positions.map((p) => {
          const key = positionKey(p)
          const on = selected.has(key)
          return (
            <label
              key={key}
              className={`flex gap-3 rounded-row border p-3.5 transition-colors ${
                on ? 'border-accent-line bg-accent-soft' : 'border-border bg-surface2'
              } ${p.closable ? 'cursor-pointer' : 'opacity-75'}`}
            >
              <input
                type="checkbox"
                className={`${CHECK} mt-0.5 flex-none`}
                checked={on}
                disabled={!p.closable}
                onChange={() => onToggle(key)}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <Who p={p} showOwner={showOwner} />
                  <span className={`flex-none font-mono text-[13px] font-bold ${pnlClass(p.unrealized_pnl)}`}>
                    {p.unrealized_pnl === null ? '—' : fmtSignedMoney(p.unrealized_pnl)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                  <span className="font-mono font-bold text-text">{p.symbol}</span>
                  <SidePill side={p.side} />
                  <span>Size <b className="font-mono text-text">{fmtQty(p.size)}</b></span>
                  <span>Entry <b className="font-mono text-text">{price(p.entry_price)}</b></span>
                  <span>Mark <b className="font-mono text-text">{price(p.mark_price)}</b></span>
                  <span>{fmtAgo(p.updated_at)}</span>
                </div>
                {!p.closable && <Blocked reason={p.blocked_reason} />}
              </div>
            </label>
          )
        })}
      </div>
    </>
  )
}
