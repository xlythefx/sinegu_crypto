import { Navigate } from 'react-router-dom'
import { KeyRound, Link2, ListTree, Lock } from 'lucide-react'
import { useApiData } from '../../../hooks/useApiData'
import { getTableStructure } from '../../../services/admin'
import { ApiError } from '../../../services/api'
import DataState from '../../dashboard/DataState'
import {
  CARD,
  CARD_SUB,
  CARD_TITLE,
  HEAD,
  HEAD_L,
  ICON_CHIP,
  NOTE_EMPTY,
  TD,
  TH,
} from './classes'

interface DatabaseStructureCardProps {
  table: string
}

const BADGE =
  'inline-flex items-center gap-1 rounded-pill border px-2 py-[3px] text-[10.5px] font-bold'

export default function DatabaseStructureCard({
  table,
}: DatabaseStructureCardProps) {
  const { data, loading, error, reload } = useApiData(
    () => getTableStructure(table),
    [table],
  )

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  if (!data) {
    return (
      <section className={CARD}>
        <DataState
          loading={loading}
          error={error}
          onRetry={reload}
          label="table structure"
        />
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-stack">
      <section className={CARD}>
        <div className={HEAD}>
          <div className={HEAD_L}>
            <span className={ICON_CHIP}>
              <ListTree size={15} />
            </span>
            <div>
              <h2 className={CARD_TITLE}>Columns</h2>
              <p className={CARD_SUB}>
                {data.columns.length} column
                {data.columns.length === 1 ? '' : 's'} in {data.table}
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[680px]">
            <thead>
              <tr>
                <th className={TH}>Column</th>
                <th className={TH}>Type</th>
                <th className={TH}>Null</th>
                <th className={TH}>Default</th>
                <th className={TH}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {data.columns.map((column) => {
                const isKey = data.key_columns.includes(column.name)
                return (
                  <tr key={column.name} className="hover:bg-surface2">
                    <td className={`${TD} font-semibold whitespace-nowrap`}>
                      <span className="inline-flex items-center gap-1.5">
                        {isKey && <KeyRound size={12} className="text-accent" />}
                        {column.name}
                      </span>
                    </td>
                    <td className={`${TD} font-mono text-[12px] text-muted`}>
                      {column.type}
                    </td>
                    <td className={TD}>
                      {column.nullable ? (
                        <span className="text-muted">YES</span>
                      ) : (
                        <span className="text-faint">NO</span>
                      )}
                    </td>
                    <td className={`${TD} font-mono text-[12px] text-muted`}>
                      {column.default ?? <span className="text-faint">—</span>}
                    </td>
                    <td className={TD}>
                      <div className="flex flex-wrap gap-1.5">
                        {isKey && (
                          <span
                            className={`${BADGE} border-accent-line bg-accent-soft text-accent`}
                          >
                            primary
                          </span>
                        )}
                        {column.auto_increment && (
                          <span
                            className={`${BADGE} border-border bg-surface2 text-muted`}
                          >
                            auto
                          </span>
                        )}
                        {column.generation !== null && (
                          <span
                            className={`${BADGE} border-border bg-surface2 text-muted`}
                          >
                            generated
                          </span>
                        )}
                        {data.masked_columns.includes(column.name) && (
                          <span
                            className={`${BADGE} border-border bg-surface2 text-faint`}
                          >
                            <Lock size={10} /> masked
                          </span>
                        )}
                        {data.binary_columns.includes(column.name) && (
                          <span
                            className={`${BADGE} border-border bg-surface2 text-faint`}
                          >
                            binary
                          </span>
                        )}
                        {column.comment && (
                          <span className="text-[11px] text-faint">
                            {column.comment}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={CARD}>
        <div className={HEAD}>
          <div className={HEAD_L}>
            <span className={ICON_CHIP}>
              <KeyRound size={15} />
            </span>
            <div>
              <h2 className={CARD_TITLE}>Indexes</h2>
              <p className={CARD_SUB}>
                {data.indexes.length} index
                {data.indexes.length === 1 ? '' : 'es'}
              </p>
            </div>
          </div>
        </div>

        {data.indexes.length === 0 ? (
          <div className={NOTE_EMPTY}>This table has no indexes.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {data.indexes.map((index) => (
              <div
                key={index.name}
                className="flex flex-wrap items-center gap-2 rounded-row border border-hair bg-surface2 px-3.5 py-2.5"
              >
                <span className="font-mono text-[12px] text-text">
                  {index.name}
                </span>
                <span className="font-mono text-[11.5px] text-muted">
                  ({index.columns.join(', ')})
                </span>
                {index.primary && (
                  <span
                    className={`${BADGE} border-accent-line bg-accent-soft text-accent`}
                  >
                    primary
                  </span>
                )}
                {index.unique && !index.primary && (
                  <span className={`${BADGE} border-border bg-surface text-muted`}>
                    unique
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={CARD}>
        <div className={HEAD}>
          <div className={HEAD_L}>
            <span className={ICON_CHIP}>
              <Link2 size={15} />
            </span>
            <div>
              <h2 className={CARD_TITLE}>Foreign keys</h2>
              <p className={CARD_SUB}>
                Deleting a row here can cascade into these tables
              </p>
            </div>
          </div>
        </div>

        {data.foreign_keys.length === 0 ? (
          <div className={NOTE_EMPTY}>No foreign keys on this table.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {data.foreign_keys.map((fk) => (
              <div
                key={fk.name}
                className="rounded-row border border-hair bg-surface2 px-3.5 py-2.5"
              >
                <div className="font-mono text-[12px] text-text break-all">
                  {fk.columns.join(', ')} → {fk.foreign_table}.
                  {fk.foreign_columns.join(', ')}
                </div>
                <div className="text-[11.5px] text-muted mt-0.5">
                  on delete {fk.on_delete ?? 'no action'} · on update{' '}
                  {fk.on_update ?? 'no action'}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
