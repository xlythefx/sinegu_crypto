import { useCallback, useMemo, useState } from 'react'
import DataState from '../../dashboard/DataState'
import PnlOverview from '../../positions/PnlOverview'
import ActivePositionsTable from '../../positions/ActivePositionsTable'
import ClosedPositionsTable from '../../positions/ClosedPositionsTable'
import CloseSourceChip, { OUTSIDE_CLOSE_EXPLAINED } from '../positions/CloseSourceChip'
import { toActiveRow, toClosedRow } from './adapters'
import { useApiData } from '../../../hooks/useApiData'
import { matchesClosedBy, type ClosedByFilter } from '../../../lib/adminPositionRows'
import { getAdminUserPositions } from '../../../services/admin'
import type { AdminUserSummary } from '../../../types/admin'
import type { ExchangePillValue } from './ExchangeFilterPill'

type Tab = 'active' | 'closed'

const SEG = 'flex gap-[3px] rounded-seg border border-hair bg-surface2 p-1'
const SEG_BTN = 'font-body rounded-btn border py-[7px] px-[13px] text-[12.5px]'
const SEG_ON = 'bg-surface border-border text-text font-bold'
const SEG_OFF = 'border-transparent bg-transparent text-muted font-semibold'
const COUNT =
  'ml-2 inline-flex h-[18px] min-w-5 items-center justify-center rounded-pill border border-accent-line bg-accent-soft px-[5px] font-mono text-[10.5px] font-semibold text-accent'

const CLOSED_BY: { value: ClosedByFilter; label: string; title?: string }[] = [
  { value: 'all', label: 'All', title: 'Every closed trade, including older ones that were never judged' },
  { value: 'outside', label: 'Outside the bot', title: OUTSIDE_CLOSE_EXPLAINED },
  { value: 'bot', label: 'By the bot', title: 'Closed by the bot: a TradingView exit, a retry or an admin’s manual close' },
]

interface UserPositionsTabProps {
  uniId: string
  exchange: ExchangePillValue
  summary: AdminUserSummary | null
}

/**
 * Positions tab: P&L tiles + Active/Closed switcher reusing the shared
 * positions tables (closed side paginated 10/page).
 *
 * The exchange pill is sent to the API rather than applied to the rows: the
 * server reads only that venue's tables, so the tiles (from the summary,
 * fetched under the same scope) and the lists describe the same money.
 */
export default function UserPositionsTab({
  uniId,
  exchange,
  summary,
}: UserPositionsTabProps) {
  const fetchPositions = useCallback(
    () => getAdminUserPositions(uniId, exchange),
    [uniId, exchange],
  )
  const { data, loading, error, reload } = useApiData(fetchPositions, [
    fetchPositions,
  ])

  const [tab, setTab] = useState<Tab>('active')
  const [page, setPage] = useState(1)
  const [closedBy, setClosedBy] = useState<ClosedByFilter>('all')

  const pctBase = summary?.pct_base ?? 0

  const active = useMemo(
    () => (data?.positions ?? []).map(toActiveRow),
    [data],
  )
  // The shared trader table has no slot for a per-row tag, so "who closed
  // it" is a filter here: "Outside the bot" lists exactly those trades.
  const closed = useMemo(
    () =>
      (data?.trades ?? [])
        .filter((t) => matchesClosedBy(t, closedBy))
        .map((t) => toClosedRow(t, pctBase)),
    [data, pctBase, closedBy],
  )
  const closedTotal = data?.trades.length ?? 0
  const outsideCount = useMemo(
    () => (data?.trades ?? []).filter((t) => t.close_source === 'outside').length,
    [data],
  )

  if (!data) {
    return (
      <DataState
        loading={loading}
        error={error}
        onRetry={reload}
        label="positions"
      />
    )
  }

  return (
    <>
      {summary && (
        <PnlOverview
          realized={summary.realized_pnl}
          unrealized={summary.unrealized_pnl}
          total={summary.total_pnl}
          pctBase={summary.pct_base}
        />
      )}

      <div className="rounded-card border border-border bg-surface px-5 py-[18px]">
        <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
          {/* who closed it — Closed tab only (an open position has no closer) */}
          {tab === 'closed' && (
            <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-faint">
                Closed by
              </span>
              <div
                className={`${SEG} max-w-full overflow-x-auto`}
                role="group"
                aria-label="Filter by who closed the trade"
              >
                {CLOSED_BY.map(({ value, label, title }) => (
                  <button
                    key={value}
                    type="button"
                    className={`${SEG_BTN} whitespace-nowrap ${closedBy === value ? SEG_ON : SEG_OFF}`}
                    title={title}
                    aria-pressed={closedBy === value}
                    onClick={() => {
                      setClosedBy(value)
                      setPage(1)
                    }}
                  >
                    {label}
                    {value === 'outside' && <span className={COUNT}>{outsideCount}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={`${SEG} ml-auto`}>
            {(
              [
                ['active', 'Active Positions', active.length],
                ['closed', 'Closed Positions', closedTotal],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                className={`${SEG_BTN} ${tab === key ? SEG_ON : SEG_OFF}`}
                onClick={() => {
                  setTab(key)
                  setPage(1)
                }}
              >
                {label}
                <span className={COUNT}>{count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* keyed re-mount replays the reveal on tab / filter / page switch */}
        <div
          key={`${tab}-${closedBy}-${page}`}
          className="animate-[fadeup_0.35s_ease-out]"
        >
          {tab === 'active' ? (
            <ActivePositionsTable rows={active} />
          ) : (
            <>
              {closedBy === 'outside' && closed.length > 0 && (
                <p className="mb-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[12.5px] text-muted">
                  <CloseSourceChip source="outside" />
                  <span className="min-w-0">{OUTSIDE_CLOSE_EXPLAINED}</span>
                </p>
              )}
              <ClosedPositionsTable
                trades={closed}
                page={page}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      </div>
    </>
  )
}
