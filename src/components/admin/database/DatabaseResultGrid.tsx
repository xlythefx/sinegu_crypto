import { useState } from 'react'
import type { DbRow } from '../../../types/admin'
import DbCell from './DbCell'
import CellValueModal from './CellValueModal'
import { NOTE_EMPTY, TH } from './classes'

interface DatabaseResultGridProps {
  columns: string[]
  rows: DbRow[]
}

/** Read-only result set for the SQL console — no row actions, no sorting. */
export default function DatabaseResultGrid({
  columns,
  rows,
}: DatabaseResultGridProps) {
  const [expanded, setExpanded] = useState<{ column: string; value: string } | null>(null)

  if (rows.length === 0) {
    return <div className={NOTE_EMPTY}>Statement ran; no rows returned.</div>
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table
          className="w-full border-collapse"
          style={{ minWidth: Math.max(480, columns.length * 160) }}
        >
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} className={TH}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="hover:bg-surface2">
                {columns.map((column) => (
                  <DbCell
                    key={column}
                    column={column}
                    value={row[column] ?? null}
                    masked={[]}
                    binary={[]}
                    onExpand={(c, v) => setExpanded({ column: c, value: v })}
                  />
                ))}
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
