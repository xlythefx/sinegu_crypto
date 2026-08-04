import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Lock, X } from 'lucide-react'
import type { DatabaseColumn, DbRow, DbValue, TableRowsData } from '../../../types/admin'
import { BTN, BTN_ACCENT, INPUT, LABEL, NOTE_ERROR, NOTE_WARN } from './classes'

interface DatabaseRowModalProps {
  open: boolean
  meta: TableRowsData
  /** null = create a new row. */
  row: DbRow | null
  saving: boolean
  error: string | null
  onSave: (values: DbRow) => void
  onCancel: () => void
}

/** Field state: `null` is distinct from '' and must be chosen explicitly. */
interface FieldState {
  text: string
  isNull: boolean
}

const MULTILINE = ['text', 'mediumtext', 'longtext', 'tinytext', 'json']

function initialField(value: DbValue | undefined): FieldState {
  if (value === null || value === undefined) return { text: '', isNull: true }
  return { text: String(value), isNull: false }
}

/**
 * Create/edit form for one row.
 *
 * Modal rather than inline editing: these tables reach 20+ columns inside a
 * horizontally scrolled grid, and an inline editor is unusable at phone width.
 * It also gives NULL its own control — without one there is no way to say
 * "NULL" as opposed to "empty string".
 *
 * On save it submits ONLY the fields that actually changed. That diff is what
 * makes server-side masking safe: an untouched masked field is never sent, so a
 * password hash can't be overwritten with bullets by round-tripping the grid.
 */
export default function DatabaseRowModal({
  open,
  meta,
  row,
  saving,
  error,
  onSave,
  onCancel,
}: DatabaseRowModalProps) {
  const isCreate = row === null

  const editable = useMemo(
    () =>
      meta.columns.filter((column) => {
        if (meta.binary_columns.includes(column.name)) return false
        if (isCreate) {
          // A generated or auto-increment column is the server's to fill.
          return !column.auto_increment && column.generation === null
        }
        return !meta.immutable_columns.includes(column.name)
      }),
    [meta, isCreate],
  )

  const [fields, setFields] = useState<Record<string, FieldState>>({})

  useEffect(() => {
    if (!open) return
    const next: Record<string, FieldState> = {}
    for (const column of editable) {
      next[column.name] = isCreate
        ? { text: '', isNull: column.nullable }
        : initialField(row?.[column.name])
    }
    setFields(next)
  }, [open, editable, isCreate, row])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  const set = (name: string, patch: Partial<FieldState>) =>
    setFields((f) => ({ ...f, [name]: { ...f[name], ...patch } }))

  /** Only what the operator actually touched. */
  const changed = (): DbRow => {
    const values: DbRow = {}

    for (const column of editable) {
      const field = fields[column.name]
      if (!field) continue

      const next: DbValue = field.isNull ? null : field.text

      if (isCreate) {
        // Skip untouched nullable fields so column defaults still apply.
        if (next === null && column.nullable) continue
        values[column.name] = next
        continue
      }

      const before = row?.[column.name] ?? null
      const beforeText = before === null ? null : String(before)
      const nextText = next === null ? null : String(next)
      if (beforeText !== nextText) values[column.name] = next
    }

    return values
  }

  const pending = changed()
  const nothingToDo = !isCreate && Object.keys(pending).length === 0

  return createPortal(
    <div
      className="fixed inset-0 bg-[rgba(0,0,0,0.55)] backdrop-blur-[3px] flex justify-center overflow-y-auto p-6 z-[1000] animate-[fadeup_0.2s_ease_both]"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={isCreate ? 'Insert row' : 'Edit row'}
    >
      <div
        className="bg-surface border border-border rounded-[20px] p-6 max-w-[620px] w-full my-auto shadow-[0_30px_80px_rgba(0,0,0,0.35)] animate-[fadeup_0.25s_cubic-bezier(0.2,0.7,0.2,1)_both]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <h3 className="font-display text-[19px] font-extrabold tracking-[-0.02em] text-text">
              {isCreate ? 'Insert row' : 'Edit row'}
            </h3>
            <p className="text-[12px] text-muted mt-px font-mono break-all">
              {meta.table}
            </p>
          </div>
          <button
            type="button"
            className="grid place-items-center w-8 h-8 flex-none rounded-[9px] border border-border bg-surface2 text-muted cursor-pointer hover:text-text"
            onClick={onCancel}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {meta.table === 'user_credentials' && (
          <div className={`${NOTE_WARN} mb-4`}>
            <span>
              Writes here bypass the app: a password typed in plain text is
              stored unhashed and will break that account&apos;s login.
            </span>
          </div>
        )}

        {error && <div className={`${NOTE_ERROR} mb-4`}>{error}</div>}

        <div className="flex flex-col gap-3.5 max-h-[52vh] overflow-y-auto pr-1">
          {editable.map((column) => (
            <Field
              key={column.name}
              column={column}
              masked={meta.masked_columns.includes(column.name)}
              state={fields[column.name] ?? { text: '', isNull: false }}
              onChange={(patch) => set(column.name, patch)}
            />
          ))}
        </div>

        <div className="flex gap-2.5 justify-end mt-5 flex-wrap">
          <button type="button" className={BTN} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={BTN_ACCENT}
            onClick={() => onSave(pending)}
            disabled={saving || nothingToDo}
          >
            {saving
              ? 'Saving…'
              : isCreate
                ? 'Insert row'
                : nothingToDo
                  ? 'No changes'
                  : `Save ${Object.keys(pending).length} change${Object.keys(pending).length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

interface FieldProps {
  column: DatabaseColumn
  masked: boolean
  state: FieldState
  onChange: (patch: Partial<FieldState>) => void
}

function Field({ column, masked, state, onChange }: FieldProps) {
  const multiline = MULTILINE.includes(column.type_name.toLowerCase())

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <label className={`${LABEL} mb-0`} htmlFor={`field-${column.name}`}>
          {column.name}
          {!column.nullable && <span className="text-red ml-1">*</span>}
        </label>
        <span className="text-[10.5px] font-mono text-faint">{column.type}</span>
      </div>

      {masked ? (
        <input
          id={`field-${column.name}`}
          className={INPUT}
          value={state.isNull ? '' : state.text}
          placeholder="Hidden — leave blank to keep, or type a new value"
          onChange={(e) => onChange({ text: e.target.value, isNull: false })}
        />
      ) : multiline ? (
        <textarea
          id={`field-${column.name}`}
          className={`${INPUT} font-mono min-h-[88px] resize-y`}
          value={state.isNull ? '' : state.text}
          disabled={state.isNull}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      ) : (
        <input
          id={`field-${column.name}`}
          className={INPUT}
          value={state.isNull ? '' : state.text}
          disabled={state.isNull}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      )}

      <div className="flex items-center gap-3 mt-1.5">
        {column.nullable && (
          <label className="inline-flex items-center gap-1.5 text-[11.5px] text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={state.isNull}
              onChange={(e) => onChange({ isNull: e.target.checked })}
            />
            NULL
          </label>
        )}
        {masked && (
          <span className="inline-flex items-center gap-1 text-[11px] text-faint">
            <Lock size={11} /> value hidden
          </span>
        )}
        {column.default !== null && (
          <span className="text-[11px] text-faint font-mono truncate">
            default {column.default}
          </span>
        )}
      </div>
    </div>
  )
}
