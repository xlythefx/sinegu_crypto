import { useCallback, useMemo, useState } from 'react'
import DataState from '../../dashboard/DataState'
import PnlOverview from '../../positions/PnlOverview'
import ActivePositionsTable from '../../positions/ActivePositionsTable'
import ClosedPositionsTable from '../../positions/ClosedPositionsTable'
import { toActiveRow, toClosedRow } from './adapters'
import { useApiData } from '../../../hooks/useApiData'
import { getAdminUserPositions } from '../../../services/admin'
import type { AdminUserSummary } from '../../../types/admin'
import type { ExchangePillValue } from './ExchangeFilterPill'

type Tab = 'active' | 'closed'

interface UserPositionsTabProps {
  uniId: string
  exchange: ExchangePillValue
  summary: AdminUserSummary | null
}

/**
 * Positions tab: P&L tiles + Active/Closed switcher reusing the shared
 * positions tables (closed side paginated 10/page).
 */
export default function UserPositionsTab({
  uniId,
  exchange,
  summary,
}: UserPositionsTabProps) {
  const fetchPositions = useCallback(() => getAdminUserPositions(uniId), [uniId])
  const { data, loading, error, reload } = useApiData(fetchPositions, [
    fetchPositions,
  ])

  const [tab, setTab] = useState<Tab>('active')
  const [page, setPage] = useState(1)

  const pctBase = summary?.pct_base ?? 0

  const active = useMemo(
    () =>
      (data?.positions ?? [])
        .map(toActiveRow)
        .filter(
          (p) => exchange === 'all' || p.exchange.toLowerCase() === exchange,
        ),
    [data, exchange],
  )
  const closed = useMemo(
    () =>
      (data?.trades ?? [])
        .map((t) => toClosedRow(t, pctBase))
        .filter(
          (t) => exchange === 'all' || t.exchange.toLowerCase() === exchange,
        ),
    [data, pctBase, exchange],
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
        <div className="mb-3.5 flex justify-end">
          <div className="flex gap-[3px] rounded-seg border border-hair bg-surface2 p-1">
            {(
              [
                ['active', 'Active Positions', active.length],
                ['closed', 'Closed Positions', closed.length],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                className={`font-body rounded-btn border py-[7px] px-[13px] text-[12.5px] ${
                  tab === key
                    ? 'bg-surface border-border text-text font-bold'
                    : 'border-transparent bg-transparent text-muted font-semibold'
                }`}
                onClick={() => {
                  setTab(key)
                  setPage(1)
                }}
              >
                {label}
                <span className="ml-2 inline-flex h-[18px] min-w-5 items-center justify-center rounded-pill border border-accent-line bg-accent-soft px-[5px] font-mono text-[10.5px] font-semibold text-accent">
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* keyed re-mount replays the reveal on tab / page switch */}
        <div
          key={`${tab}-${page}`}
          className="animate-[fadeup_0.35s_ease-out]"
        >
          {tab === 'active' ? (
            <ActivePositionsTable rows={active} />
          ) : (
            <ClosedPositionsTable
              trades={closed}
              page={page}
              onPageChange={setPage}
            />
          )}
        </div>
      </div>
    </>
  )
}
