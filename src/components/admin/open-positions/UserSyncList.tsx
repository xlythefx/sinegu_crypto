import { useState } from 'react'
import { CheckCircle2, ChevronRight, CircleSlash, AlertTriangle } from 'lucide-react'
import { EXCHANGE_META } from '../../exchanges/meta'
import PositionsList from './PositionsList'
import { EmptyNote } from '../insights/parts'
import { fmtSignedMoney } from '../../../lib/format'
import type { SideRef, SyncState, UserSync } from '../../../lib/openPositions'
import type { AdminOpenPosition } from '../../../types/openPositions'

interface UserSyncListProps {
  users: UserSync[]
  selected: Set<string>
  onToggle: (key: string) => void
  onToggleAll: (positions: AdminOpenPosition[]) => void
}

const BADGE: Record<SyncState, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  same: { label: 'Same as master', cls: 'bg-green/15 text-green', Icon: CheckCircle2 },
  differs: { label: 'Different', cls: 'bg-red/15 text-red', Icon: AlertTriangle },
  'no-master': { label: 'No master here', cls: 'bg-surface2 text-muted', Icon: CircleSlash },
}

const refs = (list: SideRef[]) => list.map((r) => `${r.symbol} ${r.side}`).join(', ')

/** One plain sentence: what this user has that the master does not, and vice versa. */
function summary(u: UserSync): string {
  if (u.state === 'no-master') return `${u.positions.length} open · the master does not trade ${EXCHANGE_META[u.exchange]?.label ?? u.exchange}`
  if (u.state === 'same') return u.positions.length ? `Holds ${refs(u.positions)}` : 'Flat, like the master'
  const parts = []
  if (u.missing.length) parts.push(`Missing ${refs(u.missing)}`)
  if (u.extra.length) parts.push(`Extra ${refs(u.extra)}`)
  return parts.join(' · ')
}

/**
 * Users compared with the master, one compact row each. Opening a row shows
 * that user's positions with the same select-to-close checkboxes as the
 * master view; the comparison itself never needs more than the one line.
 */
export default function UserSyncList({ users, selected, onToggle, onToggleAll }: UserSyncListProps) {
  const [open, setOpen] = useState<string | null>(null)

  if (users.length === 0) return <EmptyNote>No user accounts are trading right now.</EmptyNote>

  return (
    <div className="flex flex-col overflow-hidden rounded-row border border-border">
      {users.map((u, i) => {
        const b = BADGE[u.state]
        const isOpen = open === u.key
        const meta = EXCHANGE_META[u.exchange]
        return (
          <div key={u.key} className={i ? 'border-t border-border' : ''}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : u.key)}
              aria-expanded={isOpen}
              className="flex w-full cursor-pointer items-center gap-3 bg-transparent px-4 py-3 text-left transition-colors hover:bg-surface2"
            >
              <ChevronRight size={15} className={`flex-none text-muted transition-transform ${isOpen ? 'rotate-90' : ''}`} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: meta?.color }} />
                  <span className="truncate text-[13.5px] font-semibold text-text">{u.owner_name}</span>
                  {u.demo && (
                    <span className="flex-none rounded-pill bg-surface2 px-1.5 font-mono text-[10px] font-bold text-muted">DEMO</span>
                  )}
                </span>
                <span className={`block truncate text-[12px] ${u.state === 'differs' ? 'text-red' : 'text-muted'}`}>
                  {summary(u)}
                </span>
              </span>
              {u.positions.length > 0 && (
                <span className={`flex-none font-mono text-[12.5px] font-bold max-[480px]:hidden ${u.unrealized > 0 ? 'text-green' : u.unrealized < 0 ? 'text-red' : 'text-muted'}`}>
                  {fmtSignedMoney(u.unrealized)}
                </span>
              )}
              <span className={`inline-flex flex-none items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-bold ${b.cls}`}>
                <b.Icon size={12} />
                <span className="max-[480px]:hidden">{b.label}</span>
              </span>
            </button>
            {isOpen && (
              <div className="animate-[fadeup_0.25s_ease-out] border-t border-border bg-surface px-4 py-3.5">
                {u.positions.length ? (
                  <PositionsList
                    positions={u.positions}
                    selected={selected}
                    onToggle={onToggle}
                    onToggleAll={() => onToggleAll(u.positions)}
                    showOwner={false}
                  />
                ) : (
                  <div className="text-[12.5px] text-muted">No open positions.</div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
