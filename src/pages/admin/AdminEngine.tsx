import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import EngineStatusCard from '../../components/admin/engine/EngineStatusCard'
import EngineHealthCard from '../../components/admin/engine/EngineHealthCard'
import EngineLogCard from '../../components/admin/engine/EngineLogCard'
import { useApiData } from '../../hooks/useApiData'
import { useInterval } from '../../hooks/useInterval'
import { getEngineStatus, restartEngine } from '../../services/admin'
import { ApiError, getApiErrorMessage } from '../../services/api'

const TITLE = 'Bot Engine'
const SUBTITLE = 'Monitor and control the Python trading engine.'
const STATUS_REFRESH_MS = 10_000

export default function AdminEngine() {
  const { data, loading, error, reload } = useApiData(getEngineStatus)
  const [restarting, setRestarting] = useState(false)
  const [restartError, setRestartError] = useState<string | null>(null)
  const [logsToken, setLogsToken] = useState(0)

  // Poll only once the first load succeeded (avoids flickering the initial
  // loading/error panel); paused during a restart and while the tab is hidden.
  useInterval(reload, data && !restarting ? STATUS_REFRESH_MS : null)

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
          label="engine status"
        />
      </AdminLayout>
    )
  }

  const doRestart = async () => {
    setRestarting(true)
    setRestartError(null)
    try {
      await restartEngine()
      reload()
      setLogsToken((t) => t + 1)
    } catch (err) {
      setRestartError(getApiErrorMessage(err, 'Could not restart the engine.'))
    } finally {
      setRestarting(false)
    }
  }

  return (
    <AdminLayout title={TITLE} subtitle={SUBTITLE}>
      <div className="flex flex-col gap-stack">
        <EngineStatusCard
          status={data}
          restarting={restarting}
          restartError={restartError}
          onRestart={doRestart}
        />
        <EngineHealthCard health={data.health} available={data.available} />
        <EngineLogCard available={data.available} refreshToken={logsToken} />
      </div>
    </AdminLayout>
  )
}
