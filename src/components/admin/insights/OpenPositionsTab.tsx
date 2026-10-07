import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Crown, DownloadCloud, Loader2, Users, X, XOctagon } from 'lucide-react'
import ConfirmModal from '../../ui/ConfirmModal'
import DataState from '../../dashboard/DataState'
import { EmptyNote } from './parts'
import PositionsList from '../open-positions/PositionsList'
import UserSyncList from '../open-positions/UserSyncList'
import JsonPanel from '../open-positions/JsonPanel'
import ExitAllButton from '../open-positions/ExitAllButton'
import ClosePanel from '../open-positions/ClosePanel'
import CloseResult, { type CloseOutcome } from '../open-positions/CloseResult'
import { useApiData } from '../../../hooks/useApiData'
import { ApiError, getApiErrorMessage } from '../../../services/api'
import {
  closeOpenPositions,
  forceFetchOpenPositions,
  getAdminOpenPositions,
} from '../../../services/openPositions'
import { positionKey, splitByMaster } from '../../../lib/openPositions'
import { fmtAgo, fmtSignedMoney } from '../../../lib/format'
import type {
  AdminOpenPosition,
  ClosePositionsRequest,
  ClosePositionsResponse,
  OpenPositionsRefreshState,
} from '../../../types/openPositions'

type View = 'master' | 'users'

interface CloseTarget {
  positions: AdminOpenPosition[]
  /** Whose book, for "Exit all" — null for a hand-ticked selection. */
  owner: string | null
}

const toRequest = (list: AdminOpenPosition[]): ClosePositionsRequest => ({
  positions: list.map((p) => ({ exchange: p.exchange, id: p.id })),
})

/** The API's (and the engine's) per-request cap. */
const CLOSE_BATCH = 50

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

/** Several batch answers read as one close: jobs pooled, counts summed. */
function mergeAnswers(answers: { res: ClosePositionsResponse | null; error: string | null }[]): ClosePositionsResponse {
  if (answers.length === 1) {
    const [a] = answers
    return a.res && !a.error ? a.res : { ...(a.res ?? {}), success: false, message: a.error ?? a.res?.message ?? 'Close failed.' }
  }
  const sum = (k: 'filled' | 'failed' | 'skipped' | 'running') =>
    answers.reduce((s, a) => s + (a.res?.engine_response?.[k] ?? 0), 0)
  const errors = answers.flatMap((a, i) => (a.error ? [`batch ${i + 1}: ${a.error}`] : []))
  const parts = [`${sum('filled')} closed`]
  if (sum('failed')) parts.push(`${sum('failed')} failed`)
  if (sum('skipped')) parts.push(`${sum('skipped')} already flat`)
  if (sum('running')) parts.push(`${sum('running')} still running — check the Signal Log`)
  return {
    success: answers.every((a) => !a.error && a.res?.success),
    message: `${parts.join(' · ')} (${answers.length} batches).${errors.length ? ` Failed ${errors.join('; ')}.` : ''}`,
    engine_response: { jobs: answers.flatMap((a) => a.res?.engine_response?.jobs ?? []) },
  }
}

const BTN =
  'inline-flex items-center justify-center gap-1.5 rounded-pill px-4 py-2 text-[13px] font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50'
const CHIP =
  'inline-flex items-center gap-1.5 rounded-pill border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors cursor-pointer'

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
 * Admin Dashboard → Open positions. Leads with the MASTER — the strategy's own
 * book — and keeps users one click away, each compared with the master on the
 * same venue by coin + side (sizes scale with balance, so size is not a
 * difference). A forced fetch from the exchanges has a 30 s cooldown enforced
 * by the API for the whole platform; ticked rows close at market through the
 * engine's exit path without a public announcement. The request / response
 * JSON stays one click away for testing and opens itself after a close.
 */
export default function OpenPositionsTab() {
  const { data, loading, error, reload } = useApiData(getAdminOpenPositions)
  const [view, setView] = useState<View>('master')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [fetching, setFetching] = useState(false)
  const [fetchNote, setFetchNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [lastFetchAt, setLastFetchAt] = useState<string | null>(null)
  // What the confirm dialog will close: the ticked rows, or one account's
  // whole book from its "Exit all" button. Null = dialog closed.
  const [target, setTarget] = useState<CloseTarget | null>(null)
  const [lastRequest, setLastRequest] = useState<ClosePositionsRequest | null>(null)
  const [closing, setClosing] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<CloseOutcome | null>(null)
  const [response, setResponse] = useState<unknown>(null)
  const [jsonOpen, setJsonOpen] = useState(false)
  const secondsLeft = useCountdown(cooldownUntil)

  const applyRefresh = (r: OpenPositionsRefreshState | undefined) => {
    if (!r) return
    setLastFetchAt(r.last_at)
    setCooldownUntil(r.retry_after > 0 ? Date.now() + r.retry_after * 1000 : 0)
  }

  // A cooldown started elsewhere (another admin, a reload) is honoured too.
  useEffect(() => applyRefresh(data?.refresh), [data])

  const positions = useMemo(() => data?.positions ?? [], [data])
  const { master, users } = useMemo(
    () => (data ? splitByMaster(data) : { master: [], users: [] }),
    [data],
  )
  const differing = users.filter((u) => u.state === 'differs').length
  const masterPnl = master.reduce((s, p) => s + (p.unrealized_pnl ?? 0), 0)

  // Drop selections whose row disappeared after a reload.
  useEffect(() => {
    setSelected((prev) => {
      const alive = new Set(positions.filter((p) => p.closable).map(positionKey))
      const next = new Set([...prev].filter((k) => alive.has(k)))
      return next.size === prev.size ? prev : next
    })
  }, [positions])

  const chosen = positions.filter((p) => selected.has(positionKey(p)))
  const request = toRequest(chosen)
  const liveCount = chosen.filter((p) => !p.demo).length

  /** One account's whole book, straight to the confirm dialog. */
  const exitAll = (list: AdminOpenPosition[], owner: string) => {
    const closable = list.filter((p) => p.closable)
    if (closable.length) setTarget({ positions: closable, owner })
  }

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  /** Select (or clear, when all are on) every closable row of one list. */
  const toggleAll = (list: AdminOpenPosition[]) => {
    const keys = list.filter((p) => p.closable).map(positionKey)
    setSelected((prev) => {
      const next = new Set(prev)
      const allOn = keys.every((k) => prev.has(k))
      for (const k of keys) {
        if (allOn) next.delete(k)
        else next.add(k)
      }
      return next
    })
  }

  const forceFetch = async () => {
    setFetching(true)
    setFetchNote(null)
    try {
      const res = await forceFetchOpenPositions()
      applyRefresh(res.refresh)
      setFetchNote({ ok: true, text: 'Up to date.' })
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
    if (!target) return
    const closedKeys = new Set(target.positions.map(positionKey))
    const batches = chunk(target.positions, CLOSE_BATCH)
    setTarget(null)
    setClosing(true)
    setOutcome(null)
    setLastRequest(toRequest(target.positions))
    // One request per 50 (the API's cap), one after another: a failed batch
    // is reported and the rest still run — "close everyone" must not stop at
    // the first account that refuses.
    const answers: { res: ClosePositionsResponse | null; error: string | null }[] = []
    for (const [i, batch] of batches.entries()) {
      setProgress(batches.length > 1 ? `Batch ${i + 1} of ${batches.length}…` : null)
      try {
        answers.push({ res: await closeOpenPositions(toRequest(batch)), error: null })
      } catch (err) {
        answers.push({
          res: err instanceof ApiError ? (err.payload as ClosePositionsResponse) : null,
          error: getApiErrorMessage(err, 'Could not close the positions.'),
        })
      }
    }
    const merged = mergeAnswers(answers)
    setResponse(answers.length === 1 ? (answers[0].res ?? { error: answers[0].error }) : answers.map((a) => a.res ?? { error: a.error }))
    setOutcome({ ok: merged.success, message: merged.message, response: merged })
    // Only what was sent leaves the selection; other ticks survive.
    setSelected((prev) => new Set([...prev].filter((k) => !closedKeys.has(k))))
    setProgress(null)
    setClosing(false)
    setJsonOpen(true)
    reload()
  }

  const pending = target?.positions ?? []
  const pendingLive = pending.filter((p) => !p.demo).length
  const pendingAccounts = new Set(pending.map((p) => `${p.exchange}:${p.uni_id}`)).size
  const coins = pending.map((p) => `${p.symbol} ${p.side}`)
  const what = target?.owner === 'everyone'
    ? `EVERY open position on the platform — ${pending.length} across ${pendingAccounts} accounts, master included`
    : target?.owner
      ? `every open position of ${target.owner} (${pending.length}: ${coins.length > 8 ? `${coins.slice(0, 8).join(', ')} and ${coins.length - 8} more` : coins.join(', ')})`
      : pending.length === 1
        ? `${pending[0].symbol} ${pending[0].side} of ${pending[0].owner_name}`
        : `${pending.length} positions`
  const confirmMessage =
    `This closes ${what} at market price — the whole side of that coin on each account. ` +
    (pendingLive > 0
      ? `${pendingLive} ${pendingLive === 1 ? 'is on a LIVE account: real money' : 'are on LIVE accounts: real money'}. `
      : 'All of them are on demo accounts. ') +
    "The master's close is posted to the public channel like any exit; customers' closes are not."
  const confirmTitle = target?.owner
    ? `Exit all positions of ${target.owner}?`
    : `Close ${pending.length === 1 ? 'this position' : `${pending.length} positions`}?`

  return (
    <div className="flex flex-col gap-stack">
      <section className="flex min-w-0 flex-col gap-4 rounded-card border border-border bg-surface p-card">
        {/* Header: title + last fetch on the left, the fetch button on the right. */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-display text-[15px] font-extrabold">Open positions</div>
            <div className="mt-px text-[12px] text-muted">
              Fetched from the exchanges {fmtAgo(lastFetchAt)} · tick a position to close it at market
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {fetchNote && (
              <span className={`text-[12px] ${fetchNote.ok ? 'text-green' : 'text-red'}`}>{fetchNote.text}</span>
            )}
            <button
              type="button"
              onClick={forceFetch}
              disabled={fetching || secondsLeft > 0}
              className={`${BTN} border border-accent-line bg-accent-soft text-accent hover:bg-accent/15`}
            >
              {fetching ? <Loader2 size={15} className="animate-spin" /> : <DownloadCloud size={15} />}
              {fetching ? 'Fetching…' : secondsLeft > 0 ? `Fetch again in ${secondsLeft}s` : 'Fetch now'}
            </button>
          </div>
        </div>

        {/* One step: whose positions, then Close all. */}
        {data && (
          <ClosePanel
            positions={positions}
            busy={closing}
            onClose={(list, label) => setTarget({ positions: list, owner: label })}
          />
        )}
        {closing && (
          <div className="flex items-center gap-2 text-[12.5px] text-muted" role="status">
            <Loader2 size={14} className="animate-spin" /> Closing at market{progress ? ` — ${progress}` : '…'}
          </div>
        )}

        {/* View switch — outside the re-keyed region so a chip keeps focus. */}
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Whose positions">
          <button
            type="button"
            aria-pressed={view === 'master'}
            onClick={() => setView('master')}
            className={`${CHIP} ${view === 'master' ? 'border-accent-line bg-accent-soft text-accent' : 'border-border text-muted hover:text-text'}`}
          >
            <Crown size={13} /> Master
          </button>
          <button
            type="button"
            aria-pressed={view === 'users'}
            onClick={() => setView('users')}
            className={`${CHIP} ${view === 'users' ? 'border-accent-line bg-accent-soft text-accent' : 'border-border text-muted hover:text-text'}`}
          >
            <Users size={13} /> Users
            {differing > 0 && (
              <span className="rounded-pill bg-red/15 px-1.5 font-mono text-[10.5px] font-bold text-red">
                {differing} differ
              </span>
            )}
          </button>
          {data && view === 'master' && master.length > 0 && (
            <span className="ml-auto flex flex-wrap items-center gap-3 text-[12.5px] text-muted max-[640px]:ml-0">
              <span>
                {master.length} open ·{' '}
                <b className={`font-mono ${masterPnl > 0 ? 'text-green' : masterPnl < 0 ? 'text-red' : 'text-text'}`}>
                  {fmtSignedMoney(masterPnl)}
                </b>
              </span>
              <ExitAllButton
                count={master.filter((p) => p.closable).length}
                disabled={closing}
                onClick={() => exitAll(master, master[0].owner_name)}
              />
            </span>
          )}
          {data && view === 'users' && (
            <span className="ml-auto text-[12.5px] text-muted max-[640px]:ml-0">
              Compared with the master by coin and side
            </span>
          )}
        </div>

        <div key={view} className="animate-[fadeup_0.35s_ease-out]">
          {!data ? (
            <DataState loading={loading} error={error} onRetry={reload} label="open positions" />
          ) : view === 'master' ? (
            master.length ? (
              <PositionsList
                positions={master}
                selected={selected}
                onToggle={toggle}
                onToggleAll={() => toggleAll(master)}
                showOwner={false}
              />
            ) : (
              <EmptyNote>The master has no open positions.</EmptyNote>
            )
          ) : (
            <UserSyncList
              users={users}
              selected={selected}
              onToggle={toggle}
              onToggleAll={toggleAll}
              onExitAll={(u) => exitAll(u.positions, u.owner_name)}
              busy={closing}
            />
          )}
        </div>

        {/* Action bar: sticks to the bottom of the screen while something is ticked. */}
        {chosen.length > 0 && (
          <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-row border border-red/40 bg-surface px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
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
              onClick={() => setTarget({ positions: chosen, owner: null })}
              disabled={closing || chosen.length === 0}
              className={`${BTN} bg-red text-white hover:brightness-110`}
            >
              {closing ? <Loader2 size={15} className="animate-spin" /> : <XOctagon size={15} />}
              {closing ? 'Closing…' : `Close ${chosen.length === 1 ? 'position' : `${chosen.length} positions`}`}
            </button>
          </div>
        )}

        {outcome && <CloseResult outcome={outcome} />}

        {/* JSON for testing — folded away until wanted, opened after a close. */}
        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setJsonOpen((v) => !v)}
            aria-expanded={jsonOpen}
            className="inline-flex cursor-pointer items-center gap-1.5 bg-transparent p-0 text-[12.5px] font-semibold text-muted hover:text-text"
          >
            <ChevronRight size={14} className={`transition-transform ${jsonOpen ? 'rotate-90' : ''}`} />
            JSON (testing)
          </button>
          {jsonOpen && (
            <div className="mt-3 grid animate-[fadeup_0.25s_ease-out] grid-cols-2 gap-stack max-[1000px]:grid-cols-1">
              <JsonPanel
                title="Request"
                hint="POST /api/admin/open-positions/close"
                value={chosen.length ? request : lastRequest}
                empty="Tick a position or press Exit all to see the request."
              />
              <JsonPanel
                title="Response"
                hint="The API's answer, including what it forwarded to the engine"
                value={response}
                empty="Close something to see the response."
              />
            </div>
          )}
        </div>
      </section>

      <ConfirmModal
        open={target !== null}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={target?.owner ? 'Yes, exit all' : 'Yes, close'}
        cancelLabel="Cancel"
        danger
        onConfirm={close}
        onCancel={() => setTarget(null)}
      />
    </div>
  )
}
