import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { DatabaseTable } from '../../../types/admin'
import { fmtBytes } from '../../../lib/dbCells'
import { CARD, INPUT, NOTE_EMPTY } from './classes'

interface DatabaseTableRailProps {
  tables: DatabaseTable[]
  active: string | null
  onSelect: (table: string) => void
}

const ITEM_BASE =
  'w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left text-[13px] border-l-2 cursor-pointer bg-transparent'
const ITEM_ON = 'border-l-accent bg-accent-soft text-accent font-bold'
const ITEM_OFF =
  'border-l-transparent text-muted hover:bg-surface2 hover:text-text'
const COUNT =
  'flex-none rounded-pill border border-border bg-surface2 px-2 py-[2px] font-mono text-[10.5px] text-faint'

/**
 * Table picker. Renders twice by design — a sticky rail on desktop and a
 * `<select>` on mobile — with pure CSS deciding which is visible. A JS
 * breakpoint hook would flash the wrong one on first paint, and 27 hidden
 * <option>s cost nothing.
 */
export default function DatabaseTableRail({
  tables,
  active,
  onSelect,
}: DatabaseTableRailProps) {
  const [filter, setFilter] = useState('')

  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    return needle === ''
      ? tables
      : tables.filter((t) => t.name.toLowerCase().includes(needle))
  }, [tables, filter])

  return (
    <>
      {/* Mobile */}
      <section className={`${CARD} min-[1081px]:hidden`}>
        <label
          className="block text-[11px] uppercase tracking-[0.06em] text-faint font-semibold mb-1.5"
          htmlFor="db-table-select"
        >
          Table
        </label>
        <select
          id="db-table-select"
          className={INPUT}
          value={active ?? ''}
          onChange={(e) => onSelect(e.target.value)}
        >
          {tables.map((table) => (
            <option key={table.name} value={table.name}>
              {table.name} · {table.rows.toLocaleString()}
            </option>
          ))}
        </select>
      </section>

      {/* Desktop */}
      {/* CSS reveal, not AOS: every card on this page mounts after a fetch
          resolves, and AOS only tags elements its scan has already seen — an
          untagged [data-aos] card stays at opacity 0 forever. */}
      <aside
        className={`${CARD} p-0 overflow-hidden sticky top-[22px] max-h-[calc(100dvh-64px)] flex flex-col max-[1080px]:hidden animate-[fadeup_0.35s_ease-out]`}
      >
        <div className="p-3 border-b border-hair">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none"
            />
            <input
              className={`${INPUT} pl-8`}
              placeholder="Filter tables"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>

        <nav className="overflow-y-auto py-1.5">
          {shown.length === 0 ? (
            <div className={`${NOTE_EMPTY} m-3`}>No tables match.</div>
          ) : (
            shown.map((table) => (
              <button
                key={table.name}
                type="button"
                className={`${ITEM_BASE} ${table.name === active ? ITEM_ON : ITEM_OFF}`}
                onClick={() => onSelect(table.name)}
                title={`${table.name} — ${table.rows.toLocaleString()} rows, ${fmtBytes(table.size_bytes)}`}
              >
                <span className="font-mono text-[12.5px] truncate">
                  {table.name}
                </span>
                <span className={COUNT}>{table.rows.toLocaleString()}</span>
              </button>
            ))
          )}
        </nav>
      </aside>
    </>
  )
}
