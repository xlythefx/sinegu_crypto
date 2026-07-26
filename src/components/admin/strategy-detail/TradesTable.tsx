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
    <section className="dcard asd-trades" data-aos="fade-up">
      <div className="dcard__title-row">
        <span className="dchip">
          <Clock size={16} />
        </span>
        <div>
          <div className="dcard__title">Past Positions</div>
          <div className="dcard__sub">
            {filtered.length} trades
            {assetFilter ? ` · filtered by ${displaySymbol(assetFilter)}` : ''}
          </div>
        </div>
      </div>

      {assets.length > 1 && (
        <div className="asd-trades__pills">
          <button
            type="button"
            className={`asd-pill${assetFilter === null ? ' asd-pill--active' : ''}`}
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
              className={`asd-pill${assetFilter === a.ticker ? ' asd-pill--active' : ''}`}
              onClick={() => {
                onAssetFilter(assetFilter === a.ticker ? null : a.ticker)
                setPage(0)
              }}
            >
              <span className="asd-swatch" style={{ background: a.color }} />
              {a.display}
            </button>
          ))}
        </div>
      )}

      <div className="asd-trades__search">
        <Search size={15} />
        <input
          type="search"
          placeholder="Search ticker…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
        />
      </div>

      <div className="asd-table-wrap">
        <table className="asd-table">
          <thead>
            <tr>
              <th className="asd-table__num">#</th>
              <th>
                <button type="button" className="asd-table__sort" onClick={() => toggleSort('ticker')}>
                  Asset <ArrowUpDown size={12} />
                </button>
              </th>
              <th className="asd-table__right">
                <button type="button" className="asd-table__sort" onClick={() => toggleSort('pnl')}>
                  P&L <ArrowUpDown size={12} />
                </button>
              </th>
              <th className="asd-table__right">
                <button type="button" className="asd-table__sort" onClick={() => toggleSort('date')}>
                  Closed <ArrowUpDown size={12} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="asd-table__empty">
                  No trades match your filters.
                </td>
              </tr>
            ) : (
              rows.map((t, i) => (
                <tr key={`${t.symbol}-${t.closed_at}-${i}`}>
                  <td className="asd-table__num mono">
                    {clampedPage * PER_PAGE + i + 1}
                  </td>
                  <td>
                    <span className="asd-table__asset">{displaySymbol(t.symbol)}</span>
                  </td>
                  <td className={`asd-table__right mono ${t.pnl >= 0 ? 'is-pos' : 'is-neg'}`}>
                    {fmtSignedMoney(t.pnl)}
                  </td>
                  <td className="asd-table__right asd-table__muted mono">
                    {fmtDateTime(t.closed_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="asd-pager">
          <span className="asd-pager__info">
            Page {clampedPage + 1} of {totalPages} · {filtered.length} trades
          </span>
          <div className="asd-pager__btns">
            <button
              type="button"
              className="asd-icon-btn"
              onClick={() => setPage(0)}
              disabled={clampedPage === 0}
              aria-label="First page"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              className="asd-icon-btn"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={clampedPage === 0}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              className="asd-icon-btn"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={clampedPage >= totalPages - 1}
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              className="asd-icon-btn"
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
