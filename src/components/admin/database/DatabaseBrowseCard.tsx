import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Table2,
  TriangleAlert,
} from 'lucide-react'
import type { DbRow } from '../../../types/admin'
import { useApiData } from '../../../hooks/useApiData'
import {
  createTableRow,
  deleteTableRow,
  getTableRows,
  updateTableRow,
} from '../../../services/admin'
import { ApiError, getApiErrorMessage } from '../../../services/api'
import { keyOf, keyPayload } from '../../../lib/dbCells'
import DataState from '../../dashboard/DataState'
import ConfirmModal from '../../ui/ConfirmModal'
import DatabaseRowGrid from './DatabaseRowGrid'
import DatabaseRowModal from './DatabaseRowModal'
import {
  BTN_ACCENT,
  CARD,
  CARD_SUB,
  CARD_TITLE,
  HEAD,
  HEAD_L,
  ICON_CHIP,
  INPUT,
  NOTE_EMPTY,
  NOTE_ERROR,
  NOTE_WARN,
  PAG_BTN,
} from './classes'

interface DatabaseBrowseCardProps {
  table: string
  /** Bumped by the SQL console so a write there refreshes this grid. */
  refreshToken: number
}

const PER_PAGE_OPTIONS = [25, 50, 100, 200]

/** Editing state: which row the modal is on, or `create`. */
type Editing = { mode: 'create' } | { mode: 'edit'; row: DbRow }

export default function DatabaseBrowseCard({
  table,
  refreshToken,
}: DatabaseBrowseCardProps) {
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(50)
  const [sort, setSort] = useState<string | undefined>(undefined)
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState('')

  const [editing, setEditing] = useState<Editing | null>(null)
  const [deleting, setDeleting] = useState<DbRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)

  const { data, loading, error, reload } = useApiData(
    () =>
      getTableRows(table, {
        page,
        per_page: perPage,
        sort,
        direction,
        search: applied || undefined,
      }),
    [table, page, perPage, sort, direction, applied, refreshToken],
  )

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  if (!data) {
    return (
      <section className={CARD}>
        <DataState loading={loading} error={error} onRetry={reload} label="rows" />
      </section>
    )
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.per_page))

  // Compare against the server's answer, not local state: `sort` starts
  // undefined (the backend picks the primary key), so clicking that column
  // first would otherwise re-select 'asc' instead of flipping to 'desc'.
  const onSort = (column: string) => {
    if (data.sort === column) {
      setSort(column)
      setDirection(data.direction === 'asc' ? 'desc' : 'asc')
    } else {
      setSort(column)
      setDirection('asc')
    }
    setPage(1)
  }

  const applySearch = () => {
    setApplied(search.trim())
    setPage(1)
  }

  const saveRow = async (values: DbRow) => {
    setBusy(true)
    setModalError(null)
    try {
      if (editing?.mode === 'edit') {
        await updateTableRow(
          table,
          keyPayload(editing.row, data.key_columns),
          values,
        )
      } else {
        await createTableRow(table, values)
      }
      setEditing(null)
      reload()
    } catch (err) {
      setModalError(getApiErrorMessage(err, 'Could not save the row.'))
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    setActionError(null)
    try {
      await deleteTableRow(table, keyPayload(deleting, data.key_columns))
      setDeleting(null)
      reload()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not delete the row.'))
      setDeleting(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    /* No data-aos here: this card mounts after its own fetch, inside the page's
       keyed pane, so AOS's initial scan never sees it and it would stay at
       opacity 0. The pane's animate-[fadeup] wrapper does the reveal. */
    <section className={CARD}>
      <div className={HEAD}>
        <div className={HEAD_L}>
          <span className={ICON_CHIP}>
            <Table2 size={15} />
          </span>
          <div>
            <h2 className={CARD_TITLE}>{data.table}</h2>
            <p className={CARD_SUB}>
              {data.total.toLocaleString()} row{data.total === 1 ? '' : 's'}
              {applied && ` matching “${applied}”`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none"
            />
            <input
              className={`${INPUT} pl-8 w-[200px] max-[560px]:w-full`}
              placeholder="Search this table"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              onBlur={applySearch}
            />
          </div>
          {data.editable && (
            <button
              type="button"
              className={BTN_ACCENT}
              onClick={() => {
                setModalError(null)
                setEditing({ mode: 'create' })
              }}
            >
              <Plus size={13} /> New row
            </button>
          )}
        </div>
      </div>

      {!data.editable && (
        <div className={`${NOTE_WARN} mb-4`}>
          <TriangleAlert size={15} />
          <span>
            This table has no primary key, so a single row cannot be targeted
            safely — editing and deleting are disabled. Use the SQL tab.
          </span>
        </div>
      )}

      {actionError && <div className={`${NOTE_ERROR} mb-4`}>{actionError}</div>}

      {data.rows.length === 0 ? (
        <div className={NOTE_EMPTY}>
          {applied
            ? 'No rows match your search.'
            : 'This table is empty.'}
        </div>
      ) : (
        <div
          key={`${table}-${sort}-${direction}-${applied}-${page}-${perPage}`}
          className="animate-[fadeup_0.35s_ease-out]"
        >
          <DatabaseRowGrid
            data={data}
            onSort={onSort}
            onEdit={(row) => {
              setModalError(null)
              setEditing({ mode: 'edit', row })
            }}
            onDelete={setDeleting}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <div className="flex items-center gap-2 text-[12px] text-muted">
          <span>Rows per page</span>
          <select
            className={`${INPUT} w-auto py-1.5`}
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value))
              setPage(1)
            }}
          >
            {PER_PAGE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted">
            Page {data.page} of {totalPages}
          </span>
          <button
            type="button"
            className={PAG_BTN}
            disabled={data.page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            className={PAG_BTN}
            disabled={data.page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Next page"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <DatabaseRowModal
        open={editing !== null}
        meta={data}
        row={editing?.mode === 'edit' ? editing.row : null}
        saving={busy}
        error={modalError}
        onSave={saveRow}
        onCancel={() => setEditing(null)}
      />

      <ConfirmModal
        open={deleting !== null}
        title="Delete this row?"
        message={
          deleting
            ? `This permanently removes 1 row from ${table} (${keyOf(deleting, data.key_columns)}). Foreign-key cascades may remove related rows too. This cannot be undone.`
            : ''
        }
        confirmLabel={busy ? 'Deleting…' : 'Yes, delete'}
        cancelLabel="No"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </section>
  )
}
