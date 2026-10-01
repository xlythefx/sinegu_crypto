import { useEffect, useMemo, useState } from 'react'
import { Crosshair, DownloadCloud, Loader2, X, XOctagon } from 'lucide-react'
import ConfirmModal from '../../ui/ConfirmModal'
import DataState from '../../dashboard/DataState'
import { EmptyNote, InsightCard } from './parts'
import PositionsList from '../open-positions/PositionsList'
import { positionKey } from '../../../lib/openPositions'
import JsonPanel from '../open-positions/JsonPanel'
import CloseResult, { type CloseOutcome } from '../open-positions/CloseResult'
import { useApiData } from '../../../hooks/useApiData'
import { ApiError, getApiErrorMessage } from '../../../services/api'
import {
  closeOpenPositions,
  forceFetchOpenPositions,
  getAdminOpenPositions,
} from '../../../services/openPositions'
import { fmtAgo } from '../../../lib/format'
import type {
  ClosePositionsRequest,
  ClosePositionsResponse,
  OpenPositionsRefreshState,
} from '../../../types/openPositions'

const BTN =
  'inline-flex items-center justify-center gap-1.5 rounded-pill px-4 py-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50'

const STEPS = [
  ['Fetch', 'Pull the latest positions straight from the exchanges (the list otherwise updates every 5 minutes).'],
  ['Tick', 'Select the positions to close. Greyed-out rows are on accounts the engine does not trade.'],
  ['Close', 'Each one is closed at market price — the whole side of that coin on that account.'],
] as const

/** Seconds left until `until` (ms), re-rendered every second while > 0. */
function useCountdown(until: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (until <= Date.now()) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [until])
  return Math.max(0, Math.ceil((until - now) / 1000))
}

/**
 * Admin Dashboard → Open positions: every open position on every venue, a
 * forced fetch from the exchanges (30 s cooldown, enforced by the API for the
 * whole platform) and a manual close of the ticked rows.
 *
 * The close goes through the engine's normal exit path but announces nothing
 * publicly. The exact request body and the API's whole answer are shown as
 * JSON under the list, so a test run can be read without dev tools.
 */
export default function OpenPositionsTab() {
  const { data, loading, error, reload } = useApiData(getAdminOpenPositions)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [fetching, setFetching] = useState(false)
  const [fetchNote, setFetchNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [lastFetchAt, setLastFetchAt] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [outcome, setOutcome] = useState<CloseOutcome | null>(null)
  const [response, setResponse] = useState<unknown>(null)
  const secondsLeft = useCountdown(cooldownUntil)

  const applyRefresh = (r: OpenPositionsRefreshState | undefined) => {
    if (!r) return
    setLastFetchAt(r.last_at)
    setCooldownUntil(r.retry_after > 0 ? Date.now() + r.retry_after * 1000 : 0)
  }

  // A cooldown started elsewhere (another admin, a reload) is honoured too.
  useEffect(() => applyRefresh(data?.refresh), [data])

  // Drop selections whose row disappeared after a reload.
  const positions = useMemo(() => data?.positions ?? [], [data])
  useEffect(() => {
    setSelected((prev) => {
      const alive = new Set(positions.filter((p) => p.closable).map(positionKey))
      const next = new Set([...prev].filter((k) => alive.has(k)))
      return next.size === prev.size ? prev : next
    })
  }, [positions])

  const chosen = positions.filter((p) => selected.has(positionKey(p)))
  const request: ClosePositionsRequest = {
    positions: chosen.map((p) => ({ exchange: p.exchange, id: p.id })),
  }
  const liveCount = chosen.filter((p) => !p.demo).length

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const toggleAll = () => {
    const closable = positions.filter((p) => p.closable).map(positionKey)
    setSelected((prev) => (closable.every((k) => prev.has(k)) ? new Set() : new Set(closable)))
  }

  const forceFetch = async () => {
    setFetching(true)
    setFetchNote(null)
    try {
      const res = await forceFetchOpenPositions()
      applyRefresh(res.refresh)
      setFetchNote({ ok: true, text: res.message })
      reload()
    } catch (err) {
      const refresh = err instanceof ApiError
        ? (err.payload as { refresh?: OpenPositionsRefreshState } | undefined)?.refresh
        : undefined
      applyRefresh(refresh)
      setFetchNote({ ok: false, text: getApiErrorMessage(err, 'Could not fetch positions.') })
      // 503 = engine unreachable: still show whatever the DB has.
      if (err instanceof ApiError && err.status === 503) reload()
    } finally {
      setFetching(false)
    }
  }

  const close = async () => {
    setConfirmOpen(false)
    setClosing(true)
    setOutcome(null)
    try {
      const res = await closeOpenPositions(request)
      setResponse(res)
      setOutcome({ ok: res.success, message: res.message, response: res })
      setSelected(new Set())
    } catch (err) {
      const payload = err instanceof ApiError ? (err.payload as ClosePositionsResponse) : null
      setResponse(payload ?? { error: getApiErrorMessage(err, 'Close failed.') })
      setOutcome({ ok: false, message: getApiErrorMessage(err, 'Could not close the positions.'), response: payload })
    } finally {
      setClosing(false)
      reload()
    }
  }

  const sideWord = chosen.length === 1 ? `${chosen[0].symbol} ${chosen[0].side} of ${chosen[0].owner_name}` : `${chosen.length} positions`
  const confirmMessage =
    `This closes ${sideWord} at market price on the exchange — the whole side of that coin on each account. ` +
    (liveCount > 0
      ? `${liveCount} ${liveCount === 1 ? 'is a LIVE account: real money' : 'are LIVE accounts: real money'}. `
      : 'All selected accounts are demo accounts. ') +
    'Nothing is posted to the public channel.'

  return (
    <div className="flex flex-col gap-stack">
      <InsightCard
        icon={Crosshair}
        title="Open positions"
        subtitle={`Every exchange · last fetched from the exchanges ${fmtAgo(lastFetchAt)}`}
      >
        {/* How it works — three plain steps, so the page explains itself. */}
        <ol className="mb-4 grid grid-cols-3 gap-2.5 max-[900px]:grid-cols-1">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="flex gap-2.5 rounded-row border border-border bg-surface2 px-3.5 py-3">
              <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-accent-soft font-mono text-[12px] font-bold text-accent">
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-bold text-text">{title}</span>
                <span className="block text-[12px] leading-[1.5] text-muted">{text}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={forceFetch}
            disabled={fetching || secondsLeft > 0}
            className={`${BTN} border border-accent-line bg-accent-soft text-accent hover:bg-accent/15`}
          >
            {fetching ? <Loader2 size={15} className="animate-spin" /> : <DownloadCloud size={15} />}
            {fetching ? 'Fetching from exchanges…' : secondsLeft > 0 ? `Fetch again in ${secondsLeft}s` : 'Fetch from exchanges now'}
          </button>
          {fetchNote && (
            <span className={`text-[12.5px] ${fetchNote.ok ? 'text-green' : 'text-red'}`}>{fetchNote.text}</span>
          )}
          <span className="ml-auto text-[12.5px] text-muted max-[640px]:ml-0">
            {positions.length} open · {positions.filter((p) => p.closable).length} closable
          </span>
        </div>

        {data ? (
          positions.length === 0 ? (
            <EmptyNote>No open positions on any exchange. Fetch from the exchanges to double-check.</EmptyNote>
          ) : (
            <PositionsList positions={positions} selected={selected} onToggle={toggle} onToggleAll={toggleAll} />
          )
        ) : (
          <DataState loading={loading} error={error} onRetry={reload} label="open positions" />
        )}

        {/* Action bar: sticks to the bottom of the screen while something is ticked. */}
        {(chosen.length > 0 || closing) && (
          <div className="sticky bottom-3 z-10 mt-4 flex flex-wrap items-center gap-3 rounded-row border border-red/40 bg-surface px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
            <span className="min-w-0 flex-1 text-[13px] text-text">
              <b>{chosen.length}</b> selected
              {liveCount > 0 && <span className="text-red"> · {liveCount} live (real money)</span>}
            </span>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              disabled={closing}
              className={`${BTN} border border-border bg-surface2 text-text`}
            >
              <X size={14} /> Clear
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={closing || chosen.length === 0}
              className={`${BTN} bg-red text-white hover:brightness-110`}
            >
              {closing ? <Loader2 size={15} className="animate-spin" /> : <XOctagon size={15} />}
              {closing ? 'Closing…' : `Close ${chosen.length === 1 ? 'position' : `${chosen.length} positions`}`}
            </button>
          </div>
        )}

        {outcome && (
          <div className="mt-4">
            <CloseResult outcome={outcome} />
          </div>
        )}
      </InsightCard>

      <InsightCard icon={Crosshair} title="JSON" subtitle="For testing — exactly what is sent and what came back">
        <div className="grid grid-cols-2 gap-stack max-[1000px]:grid-cols-1">
          <JsonPanel
            title="Request"
            hint="POST /api/admin/open-positions/close"
            value={chosen.length ? request : null}
            empty="Tick a position to see the request."
          />
          <JsonPanel
            title="Response"
            hint="The API's answer, including what it forwarded to the engine"
            value={response}
            empty="Close something to see the response."
          />
        </div>
      </InsightCard>

      <ConfirmModal
        open={confirmOpen}
        title={`Close ${chosen.length === 1 ? 'this position' : `${chosen.length} positions`}?`}
        message={confirmMessage}
        confirmLabel="Yes, close"
        cancelLabel="Cancel"
        danger
        onConfirm={close}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
