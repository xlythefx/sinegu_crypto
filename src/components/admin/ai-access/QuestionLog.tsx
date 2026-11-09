import { useState } from 'react'
import { MessagesSquare, RefreshCw } from 'lucide-react'
import DataState from '../../dashboard/DataState'
import { useApiData } from '../../../hooks/useApiData'
import { fmtDateTimeSeconds } from '../../../lib/format'
import { getAiLog } from '../../../services/aiAccess'
import { getApiErrorMessage } from '../../../services/api'
import type { AiLogEntry } from '../../../types/aiAccess'

interface QuestionLogProps {
  /** Tool name → its plain title ("closed_trades" → "Closed trades and P&L"). */
  titles: Record<string, string>
  delay?: number
}

/** The arguments Grok sent, as one short readable line. */
function argsLine(args: AiLogEntry['arguments']): string {
  if (!args || Object.keys(args).length === 0) return 'no filters'
  if ('_truncated' in args) return String(args._truncated)
  return Object.entries(args)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ')
}

function what(entry: AiLogEntry, titles: Record<string, string>): string {
  if (entry.method === 'tools/call') return entry.tool ? (titles[entry.tool] ?? entry.tool) : 'Unknown tool'
  if (entry.method === 'initialize') return 'Connected'
  if (entry.method === 'tools/list') return 'Read the list of tools'
  return entry.method
}

/**
 * Every call the connector made, newest first — the auditor is audited.
 * "Questions" are tool calls; the handshakes Grok makes on connecting are
 * hidden unless asked for.
 */
export default function QuestionLog({ titles, delay }: QuestionLogProps) {
  const [questionsOnly, setQuestionsOnly] = useState(true)
  const [tick, setTick] = useState(0)
  const [older, setOlder] = useState<AiLogEntry[]>([])
  const [hasMore, setHasMore] = useState<boolean | null>(null)
  const [moreError, setMoreError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const { data, loading, error, reload } = useApiData(() => getAiLog({ toolsOnly: questionsOnly }), [questionsOnly, tick])
  const entries = [...(data?.entries ?? []), ...older]
  const more = hasMore ?? data?.has_more ?? false

  const refresh = () => {
    setOlder([])
    setHasMore(null)
    setTick((t) => t + 1)
  }

  const loadMore = async () => {
    const last = entries[entries.length - 1]
    if (!last) return
    setLoadingMore(true)
    setMoreError(null)
    try {
      const page = await getAiLog({ beforeId: last.id, toolsOnly: questionsOnly })
      setOlder((prev) => [...prev, ...page.entries])
      setHasMore(page.has_more)
    } catch (err) {
      setMoreError(getApiErrorMessage(err, 'Could not load older entries.'))
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <section
      className="flex min-w-0 flex-col gap-4 rounded-card border border-border bg-surface p-card max-[480px]:p-3.5"
      data-aos="fade-up"
      data-aos-delay={delay}
      aria-labelledby="ai-log"
    >
      <header className="flex flex-wrap items-start gap-3">
        <span
          className="grid h-9 w-9 flex-none place-items-center rounded-[10px] border border-accent-line bg-accent-soft text-accent"
          aria-hidden="true"
        >
          <MessagesSquare size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="ai-log" className="font-display text-[16px] font-extrabold text-text">
            What it asked
          </h2>
          <p className="mt-0.5 text-[12.5px] leading-[1.55] text-muted">
            Every look-up the AI made, with the filters it used.
            {data && (
              <>
                {' '}
                Last 24 hours: {data.last_24h.questions} look-ups, {data.last_24h.errors} errors.
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-[12px] font-semibold text-muted">
            <input
              type="checkbox"
              checked={!questionsOnly}
              onChange={(e) => {
                setOlder([])
                setHasMore(null)
                setQuestionsOnly(!e.target.checked)
              }}
              className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
            />
            Show connects too
          </label>
          <button
            type="button"
            onClick={refresh}
            aria-label="Refresh the log"
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-btn border border-border bg-surface text-muted transition-[border-color,color] duration-150 hover:border-accent hover:text-accent"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : undefined} />
          </button>
        </div>
      </header>

      {!data ? (
        <DataState loading={loading} error={error} onRetry={reload} label="the log" />
      ) : entries.length === 0 ? (
        <p className="rounded-row border border-dashed border-border py-5 text-center text-[13px] text-muted">
          Nothing yet — questions appear here as soon as the AI starts asking.
        </p>
      ) : (
        <ol key={`${questionsOnly}-${tick}`} className="flex flex-col gap-2 animate-[fadeup_0.35s_ease-out]">
          {entries.map((e) => (
            <li
              key={e.id}
              className="grid min-w-0 grid-cols-1 gap-1 rounded-row border border-border bg-surface2 px-3.5 py-2.5 sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-baseline sm:gap-4"
            >
              <span className="font-mono text-[11.5px] text-faint">{fmtDateTimeSeconds(e.created_at)}</span>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-text">
                  {what(e, titles)}
                  {e.key_name && <span className="font-normal text-muted"> · {e.key_name}</span>}
                </p>
                {e.method === 'tools/call' && (
                  <p className="mt-0.5 break-words font-mono text-[11.5px] leading-[1.5] text-muted">{argsLine(e.arguments)}</p>
                )}
                {e.status === 'error' && e.error && <p className="mt-0.5 text-[12px] text-red">{e.error}</p>}
              </div>
              <span className="font-mono text-[11px] text-faint">
                {e.duration_ms !== null ? `${e.duration_ms} ms` : ''}
                {e.ip ? ` · ${e.ip}` : ''}
              </span>
            </li>
          ))}
        </ol>
      )}

      {moreError && <p className="text-[12.5px] text-red">{moreError}</p>}
      {data && more && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex h-9 cursor-pointer items-center rounded-field border border-border bg-surface px-4 text-[12.5px] font-bold text-text transition-[border-color] duration-150 hover:border-accent-line disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? 'Loading…' : 'Show older'}
          </button>
        </div>
      )}
    </section>
  )
}
