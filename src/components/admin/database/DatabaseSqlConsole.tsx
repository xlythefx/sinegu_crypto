import { useState } from 'react'
import { CircleCheck, Play, Terminal, TriangleAlert } from 'lucide-react'
import type { SqlQueryResult } from '../../../types/admin'
import { runSqlQuery } from '../../../services/admin'
import { ApiError, getApiErrorMessage } from '../../../services/api'
import { classifySql, isUnfiltered } from '../../../lib/dbCells'
import ConfirmModal from '../../ui/ConfirmModal'
import DatabaseResultGrid from './DatabaseResultGrid'
import {
  BTN_ACCENT,
  BTN_DANGER,
  CARD,
  CARD_SUB,
  CARD_TITLE,
  CHIP_BASE,
  CHIP_OFF,
  HEAD,
  HEAD_L,
  ICON_CHIP,
  MONO_PANE,
  NOTE_ERROR,
  NOTE_OK,
  NOTE_WARN,
} from './classes'

interface DatabaseSqlConsoleProps {
  /** Prefilled into the editor when the console opens. */
  table: string | null
  /** Called after a successful write so the Browse tab refetches. */
  onWrite: () => void
}

const HISTORY_LIMIT = 10

/** Which confirmation is on screen, if any. */
type Pending = null | 'write' | 'unfiltered'

export default function DatabaseSqlConsole({
  table,
  onWrite,
}: DatabaseSqlConsoleProps) {
  const [sql, setSql] = useState(
    table ? `select * from ${table} limit 20` : 'select 1',
  )
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SqlQueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const [pending, setPending] = useState<Pending>(null)
  const [history, setHistory] = useState<string[]>([])
  const [runToken, setRunToken] = useState(0)

  const kind = classifySql(sql)
  const isWrite = kind === 'write'

  const execute = async (confirmUnfiltered: boolean) => {
    setRunning(true)
    setError(null)
    setBlocked(false)
    try {
      const res = await runSqlQuery({
        sql,
        ...(confirmUnfiltered ? { confirm_unfiltered: true } : {}),
      })
      setResult(res)
      setRunToken((t) => t + 1)
      setHistory((h) => [sql, ...h.filter((s) => s !== sql)].slice(0, HISTORY_LIMIT))
      if (res.kind === 'write') onWrite()
    } catch (err) {
      // The backend refuses an unfiltered UPDATE/DELETE once; confirming
      // re-posts the same statement with the override flag.
      if (err instanceof ApiError && err.errorCode === 'UNFILTERED_WRITE') {
        setPending('unfiltered')
        return
      }
      setResult(null)
      setBlocked(
        err instanceof ApiError &&
          (err.errorCode === 'SQL_BLOCKED' ||
            err.errorCode === 'SQL_MULTI_STATEMENT'),
      )
      setError(getApiErrorMessage(err, 'Could not run the statement.'))
    } finally {
      setRunning(false)
    }
  }

  const run = () => {
    if (sql.trim() === '') return
    if (isWrite) {
      setPending('write')
      return
    }
    void execute(false)
  }

  return (
    <section className={CARD}>
      <div className={HEAD}>
        <div className={HEAD_L}>
          <span className={ICON_CHIP}>
            <Terminal size={15} />
          </span>
          <div>
            <h2 className={CARD_TITLE}>SQL console</h2>
            <p className={CARD_SUB}>
              Reads and row writes only — schema changes are blocked
            </p>
          </div>
        </div>
      </div>

      <textarea
        className={`${MONO_PANE} w-full min-h-[150px] max-h-[320px] resize-y text-text`}
        value={sql}
        spellCheck={false}
        placeholder="select * from user_credentials limit 20"
        onChange={(e) => setSql(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            run()
          }
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
        <span
          className={`text-[11.5px] ${isWrite && isUnfiltered(sql) ? 'text-red font-semibold' : 'text-faint'}`}
        >
          {isWrite && isUnfiltered(sql)
            ? 'No WHERE clause — this would affect every row in the table.'
            : isWrite
              ? 'This statement writes rows — you will be asked to confirm.'
              : 'Ctrl/⌘ + Enter to run'}
        </span>
        <button
          type="button"
          className={isWrite ? BTN_DANGER : BTN_ACCENT}
          onClick={run}
          disabled={running || sql.trim() === ''}
        >
          <Play size={13} />
          {running ? 'Running…' : isWrite ? 'Run write' : 'Run'}
        </button>
      </div>

      {history.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <span className="text-[11px] uppercase tracking-[0.06em] text-faint font-semibold mr-1">
            Recent
          </span>
          {history.map((statement) => (
            <button
              key={statement}
              type="button"
              className={`${CHIP_BASE} ${CHIP_OFF} max-w-[240px]`}
              onClick={() => setSql(statement)}
              title={statement}
            >
              <span className="truncate font-mono text-[11px]">{statement}</span>
            </button>
          ))}
        </div>
      )}

      <div key={runToken} className="mt-4 animate-[fadeup_0.35s_ease-out]">
        {error && (
          <div className={NOTE_ERROR}>
            <TriangleAlert size={15} />
            <span>
              {blocked ? 'Blocked by the SQL gate — ' : ''}
              {error}
            </span>
          </div>
        )}

        {!error && result && result.kind === 'write' && (
          <div className={NOTE_OK}>
            <CircleCheck size={15} />
            <span>
              {result.affected ?? 0} row
              {result.affected === 1 ? '' : 's'} affected in{' '}
              {result.duration_ms} ms.
            </span>
          </div>
        )}

        {!error && result && result.kind === 'read' && (
          <>
            {result.truncated && (
              <div className={`${NOTE_WARN} mb-3`}>
                <TriangleAlert size={15} />
                <span>
                  Showing the first {result.row_count} rows — add a LIMIT to
                  narrow the result.
                </span>
              </div>
            )}
            <DatabaseResultGrid columns={result.columns} rows={result.rows} />
            <p className="text-[11.5px] text-faint mt-2.5">
              {result.row_count} row{result.row_count === 1 ? '' : 's'} ·{' '}
              {result.duration_ms} ms
            </p>
          </>
        )}
      </div>

      <ConfirmModal
        open={pending === 'write'}
        title="Run this write statement?"
        message={sql}
        confirmLabel="Run it"
        cancelLabel="Cancel"
        danger
        onConfirm={() => {
          setPending(null)
          void execute(false)
        }}
        onCancel={() => setPending(null)}
      />

      <ConfirmModal
        open={pending === 'unfiltered'}
        title="This statement has no WHERE clause"
        message={`It will affect EVERY row in the table. There is no undo.\n\n${sql}`}
        confirmLabel="I understand, run it"
        cancelLabel="Cancel"
        danger
        onConfirm={() => {
          setPending(null)
          void execute(true)
        }}
        onCancel={() => setPending(null)}
      />
    </section>
  )
}
