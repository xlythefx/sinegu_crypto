import { useMemo, useState } from 'react'
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Search,
} from 'lucide-react'
import { displaySymbol } from '../../../lib/chart'
import { fmtDateTime, fmtSignedMoney } from '../../../lib/format'
import type { AssetStat, DetailTrade } from '../../../lib/strategyStats'

const PER_PAGE = 10

const CARD = 'rounded-card border border-border bg-surface p-card'
const TITLE_ROW = 'flex items-center gap-2.5 mb-3.5'
const CHIP =
  'w-7 h-7 rounded-[9px] bg-accent-soft border border-accent-line grid place-items-center text-accent flex-none'
const CARD_TITLE = 'font-display text-[15px] font-extrabold'
const CARD_SUB = 'text-[12px] text-muted mt-px'
const SWATCH = 'w-[9px] h-[9px] rounded-[3px] flex-none'
const ICON_BTN =
  'grid place-items-center w-[30px] h-[30px] border border-border rounded-btn bg-surface text-muted cursor-pointer transition-colors enabled:hover:bg-accent-soft enabled:hover:text-accent enabled:hover:border-accent-line disabled:opacity-45 disabled:cursor-not-allowed'
const PILL_BASE =
  'inline-flex items-center gap-1.5 py-[5px] px-[11px] border rounded-pill text-[11.5px] cursor-pointer transition-colors'
const PILL_ACTIVE = `${PILL_BASE} bg-accent border-accent text-on-accent font-bold`
const PILL_IDLE = `${PILL_BASE} bg-surface2 border-border text-muted font-semibold hover:text-text`
const TH =
  'py-2.5 px-3 text-left text-[10.5px] font-bold tracking-[0.3px] uppercase text-faint'
const SORT_BTN =
  'inline-flex items-center gap-[5px] border-none bg-transparent text-faint text-[10.5px] font-bold tracking-[0.3px] uppercase cursor-pointer hover:text-text'
const TD = 'py-[9px] px-3'
const TD_RIGHT = 'py-[9px] px-3 text-right font-mono'

type SortField = 'date' | 'ticker' | 'pnl'
type SortDir = 'asc' | 'desc'

interface Props {
  trades: DetailTrade[]
  assets: AssetStat[]
  /** When set (from a heatmap/asset card click), pre-filters the table. */
  assetFilter: string | null
  onAssetFilter: (ticker: string | null) => void
}

/** Paginated, sortable, searchable closed-trades table with asset filter pills. */
export default function TradesTable({
  trades,
  assets,
  assetFilter,
  onAssetFilter,
}: Props) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const filtered = useMemo(() => {
    let list = [...trades]
    if (assetFilter) list = list.filter((t) => t.symbol === assetFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          displaySymbol(t.symbol).toLowerCase().includes(q),
      )
    }
    list.sort((a, b) => {
      let cmp = 0
      if (sortField === 'date')
        cmp =
          new Date(a.closed_at.replace(' ', 'T')).getTime() -
          new Date(b.closed_at.replace(' ', 'T')).getTime()
      else if (sortField === 'ticker') cmp = a.symbol.localeCompare(b.symbol)
      else cmp = a.pnl - b.pnl
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [trades, assetFilter, search, sortField, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const clampedPage = Math.min(page, totalPages - 1)
  const rows = filtered.slice(clampedPage * PER_PAGE, (clampedPage + 1) * PER_PAGE)

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortField(field)
      setSortDir('desc')
    }
    setPage(0)
  }

  return (
    <section className={CARD} data-aos="fade-up">
      <div className={TITLE_ROW}>
        <span className={CHIP}>
          <Clock size={16} />
        </span>
        <div>
          <div className={CARD_TITLE}>Past Positions</div>
          <div className={CARD_SUB}>
            {filtered.length} trades
            {assetFilter ? ` · filtered by ${displaySymbol(assetFilter)}` : ''}
          </div>
        </div>
      </div>

      {assets.length > 1 && (
        <div className="flex flex-wrap gap-[7px] mb-3">
          <button
            type="button"
            className={assetFilter === null ? PILL_ACTIVE : PILL_IDLE}
            onClick={() => {
              onAssetFilter(null)
              setPage(0)
            }}
          >
            All
          </button>
          {assets.map((a) => (
            <button
              type="button"
              key={a.ticker}
              className={assetFilter === a.ticker ? PILL_ACTIVE : PILL_IDLE}
              onClick={() => {
                onAssetFilter(assetFilter === a.ticker ? null : a.ticker)
                setPage(0)
              }}
            >
              <span className={SWATCH} style={{ background: a.color }} />
              {a.display}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mb-3 px-3 h-10 border border-border rounded-[11px] bg-surface2 text-faint">
        <Search size={15} />
        <input
          type="search"
          placeholder="Search ticker…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
          className="flex-1 border-none bg-transparent text-text text-[13px] outline-none"
        />
      </div>

      <div
        key={`${assetFilter ?? 'all'}-${search}-${sortField}-${sortDir}-${clampedPage}`}
        className="border border-hair rounded-row overflow-hidden animate-[fadeup_0.35s_ease-out]"
      >
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-surface2">
              <th className={`${TH} w-[44px]`}>#</th>
              <th className={TH}>
                <button type="button" className={SORT_BTN} onClick={() => toggleSort('ticker')}>
                  Asset <ArrowUpDown size={12} />
                </button>
              </th>
              <th className={`${TH} text-right`}>
                <button type="button" className={`${SORT_BTN} ml-auto`} onClick={() => toggleSort('pnl')}>
                  P&L <ArrowUpDown size={12} />
                </button>
              </th>
              <th className={`${TH} text-right`}>
                <button type="button" className={`${SORT_BTN} ml-auto`} onClick={() => toggleSort('date')}>
                  Closed <ArrowUpDown size={12} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-muted py-6 px-3">
                  No trades match your filters.
                </td>
              </tr>
            ) : (
              rows.map((t, i) => (
                <tr
                  key={`${t.symbol}-${t.closed_at}-${i}`}
                  className="border-t border-hair transition-colors hover:bg-surface2"
                >
                  <td className={`${TD} w-[44px] font-mono text-faint`}>
                    {clampedPage * PER_PAGE + i + 1}
                  </td>
                  <td className={TD}>
                    <span className="font-bold">{displaySymbol(t.symbol)}</span>
                  </td>
                  <td className={`${TD_RIGHT} ${t.pnl >= 0 ? 'text-green' : 'text-red'}`}>
                    {fmtSignedMoney(t.pnl)}
                  </td>
                  <td className={`${TD_RIGHT} text-muted`}>
                    {fmtDateTime(t.closed_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 mt-3">
          <span className="text-[12px] text-muted">
            Page {clampedPage + 1} of {totalPages} · {filtered.length} trades
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              className={ICON_BTN}
              onClick={() => setPage(0)}
              disabled={clampedPage === 0}
              aria-label="First page"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              className={ICON_BTN}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={clampedPage === 0}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              className={ICON_BTN}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={clampedPage >= totalPages - 1}
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              className={ICON_BTN}
              onClick={() => setPage(totalPages - 1)}
              disabled={clampedPage >= totalPages - 1}
              aria-label="Last page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
