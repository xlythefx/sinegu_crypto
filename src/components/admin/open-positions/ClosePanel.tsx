import { useMemo, useState } from 'react'
import { Check, Crown, Globe, Search, User, XOctagon } from 'lucide-react'
import { EXCHANGE_META } from '../../exchanges/meta'
import type { AdminOpenPosition } from '../../../types/openPositions'
import type { ExchangeKind } from '../../../types/exchanges'

export type CloseScope = 'everyone' | 'master' | 'user'

interface ClosePanelProps {
  positions: AdminOpenPosition[]
  busy: boolean
  /** Opens the confirm dialog for exactly these rows; `label` names whose book. */
  onClose: (positions: AdminOpenPosition[], label: string) => void
}

interface Owner {
  uni_id: string
  name: string
  isMaster: boolean
  positions: AdminOpenPosition[]
  exchanges: ExchangeKind[]
  accounts: string[]
}

const venue = (e: ExchangeKind) => EXCHANGE_META[e]?.label ?? e

const CHIP =
  'inline-flex items-center gap-1.5 rounded-pill border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors cursor-pointer'
const chipCls = (on: boolean) =>
  `${CHIP} ${on ? 'border-red/50 bg-red/10 text-red' : 'border-border text-muted hover:text-text'}`

const SCOPES: { id: CloseScope; label: string; Icon: typeof Globe }[] = [
  { id: 'everyone', label: 'Everyone', Icon: Globe },
  { id: 'master', label: 'Master only', Icon: Crown },
  { id: 'user', label: 'One user', Icon: User },
]

/** Every owner holding something, master first, then by name. */
function owners(positions: AdminOpenPosition[]): Owner[] {
  const map = new Map<string, Owner>()
  for (const p of positions) {
    let o = map.get(p.uni_id)
    if (!o) {
      o = { uni_id: p.uni_id, name: p.owner_name, isMaster: p.owner_type === 'master', positions: [], exchanges: [], accounts: [] }
      map.set(p.uni_id, o)
    }
    o.positions.push(p)
    if (!o.exchanges.includes(p.exchange)) o.exchanges.push(p.exchange)
    if (p.account_name && !o.accounts.includes(p.account_name)) o.accounts.push(p.account_name)
  }
  return [...map.values()].sort((a, b) => Number(b.isMaster) - Number(a.isMaster) || a.name.localeCompare(b.name))
}

/**
 * One step, one button: pick whose positions — everyone, the master alone, or
 * one user found by search — and close all of them. The confirm dialog that
 * follows lists exactly what goes; rows the engine cannot close are counted
 * here and left on the exchange.
 */
export default function ClosePanel({ positions, busy, onClose }: ClosePanelProps) {
  const [scope, setScope] = useState<CloseScope>('everyone')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string | null>(null)

  const all = useMemo(() => owners(positions), [positions])
  const pickedOwner = all.find((o) => o.uni_id === picked) ?? null

  const q = query.trim().toLowerCase()
  const matches = q
    ? all.filter((o) =>
        [o.name, o.uni_id, ...o.accounts, ...o.exchanges.map(venue)]
          .some((s) => s.toLowerCase().includes(q)),
      )
    : all

  const inScope =
    scope === 'everyone'
      ? positions
      : scope === 'master'
        ? positions.filter((p) => p.owner_type === 'master')
        : pickedOwner?.positions ?? []
  const closable = inScope.filter((p) => p.closable)
  const blocked = inScope.length - closable.length
  const accounts = new Set(closable.map((p) => `${p.exchange}:${p.uni_id}`)).size
  const live = closable.filter((p) => !p.demo).length

  const label =
    scope === 'everyone' ? 'everyone' : scope === 'master' ? (closable[0]?.owner_name ?? 'the master') : (pickedOwner?.name ?? '')

  return (
    <div className="flex flex-col gap-3 rounded-row border border-red/30 bg-red/[0.04] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 font-display text-[13.5px] font-extrabold text-text">Close positions of</span>
        {SCOPES.map(({ id, label: l, Icon }) => (
          <button key={id} type="button" aria-pressed={scope === id} onClick={() => setScope(id)} className={chipCls(scope === id)}>
            <Icon size={13} /> {l}
          </button>
        ))}
      </div>

      {scope === 'user' && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 rounded-row border border-border bg-surface px-3 py-2 focus-within:border-accent-line">
            <Search size={14} className="flex-none text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a user, account or exchange…"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-faint"
            />
          </label>
          <div className="flex max-h-56 flex-col overflow-y-auto rounded-row border border-border bg-surface">
            {matches.length === 0 ? (
              <div className="px-3 py-3 text-[12.5px] text-muted">
                {all.length ? 'No user with open positions matches.' : 'Nobody has an open position.'}
              </div>
            ) : (
              matches.map((o, i) => {
                const on = o.uni_id === picked
                return (
                  <button
                    key={o.uni_id}
                    type="button"
                    onClick={() => setPicked(on ? null : o.uni_id)}
                    aria-pressed={on}
                    className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      i ? 'border-t border-border' : ''
                    } ${on ? 'bg-red/10' : 'bg-transparent hover:bg-surface2'}`}
                  >
                    <span className={`flex h-4 w-4 flex-none items-center justify-center rounded-full border ${on ? 'border-red bg-red text-white' : 'border-border'}`}>
                      {on && <Check size={11} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-semibold text-text">{o.name}</span>
                        {o.isMaster && (
                          <span className="flex-none rounded-pill bg-accent-soft px-1.5 font-mono text-[10px] font-bold text-accent">MASTER</span>
                        )}
                      </span>
                      <span className="block truncate text-[11.5px] text-muted">
                        {o.exchanges.map(venue).join(' · ')}
                        {o.accounts.length ? ` · ${o.accounts.join(', ')}` : ''}
                      </span>
                    </span>
                    <span className="flex-none font-mono text-[12px] font-bold text-text">{o.positions.length} open</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1 text-[12.5px] text-muted">
          {scope === 'user' && !pickedOwner ? (
            'Pick a user above.'
          ) : closable.length === 0 ? (
            'Nothing to close.'
          ) : (
            <>
              <b className="text-text">{closable.length}</b> {closable.length === 1 ? 'position' : 'positions'} on{' '}
              <b className="text-text">{accounts}</b> {accounts === 1 ? 'account' : 'accounts'}
              {live > 0 && <span className="text-red"> · {live} live (real money)</span>}
            </>
          )}
          {blocked > 0 && <span className="block text-[11.5px]">{blocked} more cannot be closed here — see the reason on the row.</span>}
        </span>
        <button
          type="button"
          onClick={() => onClose(closable, label)}
          disabled={busy || closable.length === 0}
          className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-pill bg-red px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 max-[480px]:w-full"
        >
          <XOctagon size={15} />
          Close all{closable.length ? ` (${closable.length})` : ''}
        </button>
      </div>
    </div>
  )
}
