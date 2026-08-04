import { useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react'
import type { DbRow, TableRowsData } from '../../../types/admin'
import { keyOf } from '../../../lib/dbCells'
import DbCell from './DbCell'
import CellValueModal from './CellValueModal'
import { ICON_BTN, ICON_BTN_DANGER, TD, TH, TH_BTN } from './classes'

interface DatabaseRowGridProps {
  data: TableRowsData
  onSort: (column: string) => void
  onEdit: (row: DbRow) => void
  onDelete: (row: DbRow) => void
}

/**
 * The Browse grid. Column count is dynamic, so the minimum width is an inline
 * style rather than a class — and the actions column is sticky so edit/delete
 * stay reachable however far the table is scrolled sideways.
 */
export default function DatabaseRowGrid({
  data,
  onSort,
  onEdit,
  onDelete,
}: DatabaseRowGridProps) {
  const [expanded, setExpanded] = useState<{ column: string; value: string } | null>(null)

  const names = data.columns.map((c) => c.name)
  const showActions = data.editable

  return (
    <>
      <div className="overflow-x-auto">
        <table
          className="w-full border-collapse"
          style={{ minWidth: Math.max(640, names.length * 160) }}
        >
          <thead>
            <tr>
              {data.columns.map((column) => (
                <th key={column.name} className={TH}>
                  <button
                    type="button"
                    className={TH_BTN}
                    onClick={() => onSort(column.name)}
                    title={`Sort by ${column.name} (${column.type})`}
                  >
                    {column.name}
                    {data.sort === column.name &&
                      (data.direction === 'asc' ? (
                        <ArrowUp size={11} />
                      ) : (
                        <ArrowDown size={11} />
                      ))}
                  </button>
                </th>
              ))}
              {showActions && (
                <th className={`${TH} sticky right-0 bg-surface text-right`}>
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, index) => (
              <tr
                key={
                  data.key_columns.length > 0
                    ? keyOf(row, data.key_columns)
                    : index
                }
                className="group hover:bg-surface2"
              >
                {names.map((name) => (
                  <DbCell
                    key={name}
                    column={name}
                    value={row[name] ?? null}
                    masked={data.masked_columns}
                    binary={data.binary_columns}
                    onExpand={(c, v) => setExpanded({ column: c, value: v })}
                  />
                ))}
                {showActions && (
                  <td
                    className={`${TD} sticky right-0 bg-surface group-hover:bg-surface2`}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        className={ICON_BTN}
                        onClick={() => onEdit(row)}
                        aria-label="Edit row"
                        title="Edit row"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className={ICON_BTN_DANGER}
                        onClick={() => onDelete(row)}
                        aria-label="Delete row"
                        title="Delete row"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CellValueModal
        open={expanded !== null}
        column={expanded?.column ?? ''}
        value={expanded?.value ?? ''}
        onClose={() => setExpanded(null)}
      />
    </>
  )
}
