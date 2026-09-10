import { useMemo, useRef, useState } from 'react'
import { Building2, Layers, List, Rows3, Search, Tags, User, X } from 'lucide-react'
import { displaySymbol } from '../../../lib/chart'
import {
  hasActiveFilters,
  type AccountOption,
  type PositionFilters,
  type PositionView,
} from '../../../lib/adminPositionRows'

interface Props {
  filters: PositionFilters
  onChange: (patch: Partial<PositionFilters>) => void
  onClear: () => void
  view: PositionView
  onView: (v: PositionView) => void
  accounts: AccountOption[]
  tickers: string[]
  brokers: string[]
  /** Rows after filtering / rows in the tab — rendered as "X of Y". */
  shown: number
  total: number
}

const FIELD =
  'flex items-center gap-2 h-10 px-3 border border-border rounded-nav bg-surface2 text-faint'
const SELECT =
  'border-0 bg-transparent text-text text-[13px] font-semibold outline-none cursor-pointer min-w-[130px] max-w-[190px]'
const OPTION = 'bg-surface text-text'

const TOGGLE =
  'inline-flex items-center gap-1.5 h-8 px-3 rounded-[9px] text-[12.5px] font-bold cursor-pointer transition-colors'

/** Search + per-user / ticker / broker facets + the combined-or-per-row switch.
 *
 *  Deliberately rendered OUTSIDE the animated results container: that container
 *  is re-keyed on every filter change so the table replays its reveal, and a
 *  re-key unmounts everything inside it — which is what used to blow the search
 *  box's focus away on each keystroke. */
export default function PositionsToolbar({
  filters,
  onChange,
  onClear,
  view,
  onView,
  accounts,
  tickers,
  brokers,
  shown,
  total,
}: Props) {
  const [suggestOpen, setSuggestOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Suggestions complete the LAST term only, so "master ltc" keeps narrowing
  // instead of the click throwing the account name away. A trailing space means
  // the next term has been started, so nothing is replaced.
  const terms = filters.search.split(/\s+/).filter(Boolean)
  const newTerm = filters.search === '' || /\s$/.test(filters.search)
  const lastTerm = newTerm ? '' : (terms[terms.length - 1] ?? '').toLowerCase()

  const suggestions = useMemo(() => {
    const pool = [
      ...accounts.map((a) => a.name),
      ...tickers.map(displaySymbol),
      ...brokers,
    ]
    const seen = new Set<string>()
    const out: string[] = []
    for (const v of pool) {
      const k = v.toLowerCase()
      if (seen.has(k) || k === lastTerm) continue
      if (lastTerm && !k.includes(lastTerm)) continue
      seen.add(k)
      out.push(v)
      if (out.length === 6) break
    }
    return out
  }, [accounts, tickers, brokers, lastTerm])

  const pick = (value: string) => {
    const next = [...terms]
    if (!newTerm && next.length) next[next.length - 1] = value
    else next.push(value)
    onChange({ search: next.join(' ') })
    setSuggestOpen(false)
    inputRef.current?.focus()
  }

  const active = hasActiveFilters(filters)

  return (
    <div className="flex flex-wrap items-center gap-2.5 py-[18px] px-5">
      {/* search + autosuggest */}
      <div className="relative flex-1 min-w-[220px] max-w-[320px] max-[560px]:max-w-none">
        <label className={FIELD}>
          <Search size={14} />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 min-w-0 border-0 bg-transparent text-text text-[13px] outline-none"
            placeholder="Search account, ID, ticker…"
            value={filters.search}
            autoComplete="off"
            onChange={(e) => {
              onChange({ search: e.target.value })
              setSuggestOpen(true)
            }}
            onFocus={() => setSuggestOpen(true)}
            onBlur={() => setSuggestOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSuggestOpen(false)
              if (e.key === 'Enter' && suggestions.length === 1) {
                e.preventDefault()
                pick(suggestions[0])
              }
            }}
          />
          {filters.search !== '' && (
            <button
              type="button"
              className="grid place-items-center w-5 h-5 rounded-btn text-faint cursor-pointer hover:text-text"
              aria-label="Clear search"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange({ search: '' })
                inputRef.current?.focus()
              }}
            >
              <X size={13} />
            </button>
          )}
        </label>
        {suggestOpen && suggestions.length > 0 && (
          <ul className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 py-1.5 border border-border rounded-nav bg-surface shadow-[0_18px_40px_rgba(0,0,0,0.45)] overflow-hidden animate-[fadeup_0.18s_ease-out]">
            {suggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  className="flex items-center gap-2 w-full py-2 px-3 bg-transparent text-left text-[12.5px] font-semibold text-text cursor-pointer transition-colors hover:bg-surface2"
                  // keep the input focused: mousedown fires before blur
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(s)}
                >
                  <Search size={12} className="text-faint flex-none" />
                  <span className="truncate">{s}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* per-user */}
      <label className={FIELD}>
        <User size={14} />
        <select
          className={SELECT}
          value={filters.account}
          onChange={(e) => onChange({ account: e.target.value })}
          aria-label="Filter by user account"
        >
          <option className={OPTION} value="all">
            All accounts
          </option>
          {accounts.map((a) => (
            <option className={OPTION} key={a.id} value={String(a.id)}>
              {a.name} · ID {a.id}
            </option>
          ))}
        </select>
      </label>

      <label className={FIELD}>
        <Tags size={14} />
        <select
          className={SELECT}
          value={filters.ticker}
          onChange={(e) => onChange({ ticker: e.target.value })}
          aria-label="Filter by ticker"
        >
          <option className={OPTION} value="all">
            All tickers
          </option>
          {tickers.map((t) => (
            <option className={OPTION} key={t} value={t}>
              {displaySymbol(t)}
            </option>
          ))}
        </select>
      </label>

      <label className={FIELD}>
        <Building2 size={14} />
        <select
          className={SELECT}
          value={filters.broker}
          onChange={(e) => onChange({ broker: e.target.value })}
          aria-label="Filter by exchange"
        >
          <option className={OPTION} value="all">
            All exchanges
          </option>
          {brokers.map((b) => (
            <option className={OPTION} key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </label>

      {/* combined ↔ per-row */}
      <div
        className="flex items-center gap-1 p-1 border border-hair rounded-nav bg-surface2"
        role="group"
        aria-label="Row grouping"
      >
        <button
          type="button"
          className={`${TOGGLE} ${
            view === 'grouped'
              ? 'bg-accent text-on-accent'
              : 'bg-transparent text-muted hover:text-text'
          }`}
          onClick={() => onView('grouped')}
          aria-pressed={view === 'grouped'}
          title="Merge same account + ticker into one row"
        >
          <Layers size={13} />
          Combined
        </button>
        <button
          type="button"
          className={`${TOGGLE} ${
            view === 'rows'
              ? 'bg-accent text-on-accent'
              : 'bg-transparent text-muted hover:text-text'
          }`}
          onClick={() => onView('rows')}
          aria-pressed={view === 'rows'}
          title="One row per database entry"
        >
          <List size={13} />
          Per row
        </button>
      </div>

      <div className="flex items-center gap-2 ml-auto max-[560px]:ml-0">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted font-mono">
          <Rows3 size={13} className="text-faint" />
          {shown.toLocaleString()} of {total.toLocaleString()}
        </span>
        {active && (
          <button
            type="button"
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-btn bg-transparent text-muted text-[12px] font-semibold cursor-pointer transition-colors hover:text-text hover:bg-surface2"
            onClick={onClear}
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
