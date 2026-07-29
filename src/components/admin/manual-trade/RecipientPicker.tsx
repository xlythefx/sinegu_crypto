import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, Users, X } from 'lucide-react'
import {
  CARD,
  CARD_HEAD,
  CARD_SUB,
  CARD_TITLE,
  CHIP,
  INPUT,
  SEG,
  SEG_OFF,
  SEG_ON,
} from './classes'
import { fmtMoney } from '../../../lib/format'
import type { ManualTradeTarget, RecipientMode } from '../../../types/manualTrade'

const PER_PAGE = 8

/**
 * Who receives the signal: everyone the engine would trade, or a hand-picked
 * subset (which becomes `target_uni_ids` — the same field the retry queue uses).
 */
export default function RecipientPicker({
  targets,
  loading,
  mode,
  onModeChange,
  selected,
  onSelectedChange,
}: {
  targets: ManualTradeTarget[]
  loading: boolean
  mode: RecipientMode
  onModeChange: (mode: RecipientMode) => void
  selected: string[]
  onSelectedChange: (ids: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const selectedTargets = useMemo(
    () => targets.filter((t) => selected.includes(t.uni_id)),
    [targets, selected],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return targets
      .filter((t) => !selected.includes(t.uni_id))
      .filter((t) =>
        !q
          ? true
          : [t.display_name, t.email, t.uni_id].some((v) =>
              String(v ?? '').toLowerCase().includes(q),
            ),
      )
  }, [targets, selected, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)

  return (
    <section className={CARD} data-aos="fade-up" data-aos-delay="60">
      <div className={CARD_HEAD}>
        <span className={CHIP}>
          <Users size={16} />
        </span>
        <div className="min-w-0">
          <div className={CARD_TITLE}>Recipients</div>
          <div className={CARD_SUB}>
            Suspended users and disabled accounts never appear here.
          </div>
        </div>
      </div>

      {/* mode toggle */}
      <div className="grid grid-cols-2 gap-2 mb-3.5">
        {(['all', 'selected'] as RecipientMode[]).map((m) => (
          <button
            key={m}
            type="button"
            className={`${SEG} ${mode === m ? SEG_ON : SEG_OFF}`}
            onClick={() => {
              onModeChange(m)
              if (m === 'all') {
                onSelectedChange([])
                setSearch('')
              }
            }}
          >
            {m === 'all' ? 'All users' : 'Pick users'}
          </button>
        ))}
      </div>

      {mode === 'all' ? (
        <div className="rounded-[12px] border border-hair bg-surface2 p-3.5 text-[13px] text-muted">
          {loading ? (
            'Loading users…'
          ) : targets.length > 0 ? (
            <>
              <span className="font-bold text-text">{targets.length}</span> user
              {targets.length === 1 ? '' : 's'} (
              {targets.reduce((sum, t) => sum + t.account_count, 0)} account
              {targets.reduce((sum, t) => sum + t.account_count, 0) === 1 ? '' : 's'}) will
              receive this signal.
            </>
          ) : (
            <span className="text-red">
              No eligible users — nothing would be traded.
            </span>
          )}
        </div>
      ) : (
        <div
          className="flex flex-col gap-3 animate-[fadeup_0.35s_ease-out]"
          key={`picker-${targets.length}`}
        >
          {/* selected chips */}
          {selectedTargets.length > 0 && (
            <div className="flex flex-wrap gap-1.5 max-h-[104px] overflow-y-auto">
              {selectedTargets.map((t) => (
                <span
                  key={t.uni_id}
                  className="inline-flex items-center gap-1 rounded-pill border border-accent-line bg-accent-soft py-1 pl-2.5 pr-1.5 text-[11.5px] font-bold text-accent"
                >
                  {t.display_name || t.email || t.uni_id}
                  <button
                    type="button"
                    aria-label={`Remove ${t.display_name}`}
                    className="grid place-items-center rounded-full p-0.5 cursor-pointer hover:bg-[color-mix(in_srgb,var(--accent)_18%,transparent)]"
                    onClick={() =>
                      onSelectedChange(selected.filter((id) => id !== t.uni_id))
                    }
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* search */}
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
            <input
              className={`${INPUT} pl-9`}
              value={search}
              placeholder={loading ? 'Loading users…' : 'Search name or email…'}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>

          {/* list */}
          <div className="rounded-[12px] border border-hair overflow-hidden">
            {loading ? (
              <p className="py-6 text-center text-[13px] text-muted">Loading users…</p>
            ) : paged.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-muted">
                {targets.length === 0 ? 'No eligible users.' : 'No matches.'}
              </p>
            ) : (
              paged.map((t) => (
                <button
                  key={t.uni_id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 border-b border-hair last:border-0 px-3.5 py-2.5 text-left cursor-pointer bg-surface2 transition-[background] duration-150 hover:bg-accent-soft"
                  onClick={() => {
                    onSelectedChange([...selected, t.uni_id])
                    setSearch('')
                    setPage(1)
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold text-text">
                      {t.display_name}
                    </span>
                    <span className="block truncate text-[11.5px] text-muted">
                      {t.email ?? t.uni_id}
                    </span>
                  </span>
                  <span className="flex-none text-right">
                    <span className="block font-mono text-[11.5px] text-muted">
                      {fmtMoney(t.balance)}
                    </span>
                    <span className="block text-[11px] font-bold">
                      {t.live_count > 0 && <span className="text-green">live</span>}
                      {t.live_count > 0 && t.demo_count > 0 && (
                        <span className="text-muted"> · </span>
                      )}
                      {t.demo_count > 0 && <span className="text-accent">demo</span>}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>

          {/* pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-[11.5px] text-muted">
              <span>
                {(safePage - 1) * PER_PAGE + 1}–
                {Math.min(safePage * PER_PAGE, filtered.length)} of {filtered.length}
              </span>
              <span className="flex gap-1.5">
                <button
                  type="button"
                  aria-label="Previous page"
                  className="grid place-items-center w-7 h-7 rounded-[8px] border border-border bg-surface2 text-muted cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:border-accent hover:enabled:text-text"
                  disabled={safePage === 1}
                  onClick={() => setPage(safePage - 1)}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Next page"
                  className="grid place-items-center w-7 h-7 rounded-[8px] border border-border bg-surface2 text-muted cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:border-accent hover:enabled:text-text"
                  disabled={safePage === totalPages}
                  onClick={() => setPage(safePage + 1)}
                >
                  <ChevronRight size={14} />
                </button>
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
