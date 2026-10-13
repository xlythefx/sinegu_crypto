import { useCallback, useEffect, useState } from 'react'
import { Bot, ShieldAlert, UserRound } from 'lucide-react'
import { getAssetHistory } from '../../../services/admin'
import { getApiErrorMessage } from '../../../services/api'
import { displaySymbol } from '../../../lib/chart'
import { fmtDateTime } from '../../../lib/format'
import { actorText, changeLines, EVENT_LABEL, EVENT_TONE, type EventTone } from '../../../lib/assetHistory'
import type { AssetChangeRow } from '../../../types/admin'

const PAGE = 50

const TONE: Record<EventTone, string> = {
  good: 'border-[color-mix(in_srgb,var(--green)_40%,transparent)] bg-[color-mix(in_srgb,var(--green)_9%,transparent)] text-green',
  neutral: 'border-border bg-surface2 text-text',
  wait: 'border-accent-line bg-accent-soft text-accent',
  muted: 'border-border bg-surface2 text-muted',
  bad: 'border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_9%,transparent)] text-red',
}

interface AssetHistoryListProps {
  /** One coin card's history; omit for every coin. */
  assetId?: number
  /** Narrow to one exchange (`assets.broker`, e.g. "Binance"); omit for all. */
  broker?: string
  /** Hide the coin name on each row (the caller already says which coin). */
  hideCoin?: boolean
}

function Row({ row, hideCoin }: { row: AssetChangeRow; hideCoin: boolean }) {
  const lines = changeLines(row)
  const ActorIcon = row.event === 'kill_switch' ? ShieldAlert : row.is_system ? Bot : UserRound
  return (
    <li className="flex flex-col gap-1.5 border-t border-hair py-3.5 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span
          className={`rounded-pill border px-2.5 py-[2px] text-[11px] font-bold ${TONE[EVENT_TONE[row.event] ?? 'neutral']}`}
        >
          {EVENT_LABEL[row.event] ?? row.event}
        </span>
        {!hideCoin && (
          <span className="font-mono text-[12.5px] font-bold text-text">
            {displaySymbol(row.ticker)}
            {row.broker && <span className="font-body font-normal text-muted"> · {row.broker}</span>}
          </span>
        )}
        <span className="ml-auto whitespace-nowrap text-[11.5px] text-faint">
          {row.created_at ? fmtDateTime(row.created_at) : ''}
        </span>
      </div>
      {lines.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {lines.map((line) => (
            <li key={line} className="font-mono text-[12px] leading-[1.5] text-text">
              {line}
            </li>
          ))}
        </ul>
      )}
      <p className="flex items-start gap-1.5 text-[11.5px] leading-[1.5] text-muted">
        <ActorIcon size={12} className="mt-[3px] flex-none text-faint" aria-hidden="true" />
        <span>
          {actorText(row).replace(/^./, (c) => c.toUpperCase())}
          {row.note && <span className="text-faint"> — {row.note}</span>}
        </span>
      </p>
    </li>
  )
}

/**
 * Asset change history, newest first: what changed, from → to, who did it
 * (or "automatically" / "by the kill switch"), and why when the system knows.
 * Pages back 50 at a time.
 */
export default function AssetHistoryList({ assetId, broker, hideCoin = false }: AssetHistoryListProps) {
  const [rows, setRows] = useState<AssetChangeRow[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (beforeId?: number) => {
      setError(null)
      try {
        const page = await getAssetHistory({ assetId, broker, beforeId, limit: PAGE })
        setRows((prev) => (beforeId && prev ? [...prev, ...page.changes] : page.changes))
        setHasMore(page.has_more)
      } catch (err) {
        setError(getApiErrorMessage(err, 'Could not load the change history.'))
        if (!beforeId) setRows([])
      }
    },
    [assetId, broker],
  )

  useEffect(() => {
    setRows(null)
    load()
  }, [load])

  const more = async () => {
    if (!rows?.length) return
    setLoadingMore(true)
    await load(rows[rows.length - 1].id)
    setLoadingMore(false)
  }

  if (rows === null) {
    return <p className="py-6 text-center text-[13px] text-faint">Loading the history…</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p
          className="rounded-field border border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] px-3.5 py-2.5 text-[12.5px] text-red"
          role="alert"
        >
          {error}
        </p>
      )}
      {rows.length === 0 && !error ? (
        <p className="py-6 text-center text-[13px] leading-[1.6] text-muted">
          No changes recorded yet. Every change from 14 Oct 2026 on is listed here — who made it,
          and what it was before.
        </p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((row) => (
            <Row key={row.id} row={row} hideCoin={hideCoin} />
          ))}
        </ul>
      )}
      {hasMore && (
        <button
          type="button"
          className="mx-auto inline-flex h-9 items-center rounded-pill border border-border bg-surface2 px-4 text-[12.5px] font-semibold text-text transition-colors duration-150 hover:border-accent disabled:opacity-50"
          onClick={more}
          disabled={loadingMore}
        >
          {loadingMore ? 'Loading…' : 'Show older changes'}
        </button>
      )}
    </div>
  )
}
