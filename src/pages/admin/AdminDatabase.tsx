import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Database } from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import NoticeStrip from '../../components/ui/NoticeStrip'
import DatabaseTableRail from '../../components/admin/database/DatabaseTableRail'
import DatabaseTabs, {
  type DatabaseTab,
} from '../../components/admin/database/DatabaseTabs'
import DatabaseBrowseCard from '../../components/admin/database/DatabaseBrowseCard'
import DatabaseStructureCard from '../../components/admin/database/DatabaseStructureCard'
import DatabaseSqlConsole from '../../components/admin/database/DatabaseSqlConsole'
import { useApiData } from '../../hooks/useApiData'
import { useSessionUser } from '../../hooks/useSessionUser'
import { isDeveloper } from '../../lib/roles'
import { getDatabaseTables } from '../../services/admin'
import { ApiError } from '../../services/api'

const TITLE = 'Database'
const SUBTITLE = 'Browse tables, edit rows, and run SQL against the live database.'

export default function AdminDatabase() {
  const user = useSessionUser()
  const { data, loading, error, reload } = useApiData(getDatabaseTables)
  const [selected, setSelected] = useState<string | null>(null)
  const [tab, setTab] = useState<DatabaseTab>('browse')
  // Bumped when the SQL console writes, so the Browse grid refetches.
  const [dataToken, setDataToken] = useState(0)

  // Developer-only. Admin and master reach every other /admin page but not the
  // console — the API's `developer` middleware enforces the same rule, so this
  // only spares them a 403 they could do nothing about.
  if (user && !isDeveloper(user.type)) {
    return <Navigate to="/admin" replace />
  }

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  if (!data) {
    return (
      <AdminLayout title={TITLE} subtitle={SUBTITLE}>
        <DataState
          loading={loading}
          error={error}
          onRetry={reload}
          label="database tables"
        />
      </AdminLayout>
    )
  }

  const table = selected ?? data.tables[0]?.name ?? null

  return (
    <AdminLayout title={TITLE} subtitle={SUBTITLE}>
      <NoticeStrip
        icon={<Database size={16} />}
        message={`Connected to ${data.database} (${data.driver}) — this is the live database. Edits take effect immediately and cannot be undone.`}
        tone="danger"
      />

      <div className="grid grid-cols-[268px_minmax(0,1fr)] max-[1080px]:grid-cols-1 gap-4 items-start">
        <DatabaseTableRail
          tables={data.tables}
          active={table}
          onSelect={(name) => {
            setSelected(name)
            setTab('browse')
          }}
        />

        <div className="min-w-0 flex flex-col gap-4">
          <DatabaseTabs active={tab} onChange={setTab} />

          {table === null ? (
            <DataState
              loading={false}
              error={null}
              onRetry={reload}
              label="tables"
            />
          ) : (
            <div key={`${table}-${tab}`} className="animate-[fadeup_0.35s_ease-out]">
              {tab === 'browse' && (
                <DatabaseBrowseCard table={table} refreshToken={dataToken} />
              )}
              {tab === 'structure' && <DatabaseStructureCard table={table} />}
              {tab === 'sql' && (
                <DatabaseSqlConsole
                  table={table}
                  onWrite={() => setDataToken((t) => t + 1)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
