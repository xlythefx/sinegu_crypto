import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import ActionsCard from '../../components/admin/errorbot/ActionsCard'
import ControlsCard from '../../components/admin/errorbot/ControlsCard'
import JobsCard from '../../components/admin/errorbot/JobsCard'
import MemoryCard from '../../components/admin/errorbot/MemoryCard'
import StatusCard from '../../components/admin/errorbot/StatusCard'
import { useApiData } from '../../hooks/useApiData'
import { ApiError } from '../../services/api'
import {
  cancelDevBotJob,
  deleteDevBotMemory,
  getAdminDevBot,
  retryDevBotJob,
  saveDevBotMemory,
  sendDevBotTest,
  updateDevBotSettings,
} from '../../services/adminDevBot'
import type { DevBotSettingsPatch } from '../../types/adminDevBot'

const TITLE = 'Error Bot'
const SUBTITLE =
  'The private Telegram bot (@errorpixel_bot): whether every service is up, what it may send you, and what the AI developer on your PC did.'

/**
 * Admin → Error Bot (2026-11-23): the developer error bot from the admin side.
 * Status checks, message switches + mute, the PC agent's pause, a test
 * message, the agent's jobs (cancel / run again) and the buttons' history.
 * Full admins only (not in the collaborator allowlist).
 */
export default function AdminErrorBot() {
  const { data, loading, error, reload } = useApiData(getAdminDevBot)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  const attempt = async (fn: () => Promise<unknown>, okText: string) => {
    try {
      await fn()
      setNotice({ ok: true, text: okText })
      reload()
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error && e.message ? e.message : 'That did not work. Try again.' })
    }
  }

  if (!data) {
    return (
      <AdminLayout title={TITLE} subtitle={SUBTITLE}>
        <DataState loading={loading} error={error} onRetry={reload} label="the error bot" />
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title={TITLE} subtitle={SUBTITLE}>
      {notice && (
        <p role="status" className={`mb-stack rounded-[10px] border px-card py-3 text-[13px] font-semibold ${
          notice.ok ? 'border-green/40 text-green' : 'border-red/40 text-red'}`}>
          {notice.text}
        </p>
      )}
      <div className="flex flex-col gap-stack">
        <div className="grid min-w-0 gap-stack lg:grid-cols-2">
          <StatusCard data={data} refreshing={loading} onRefresh={reload} />
          <ControlsCard
            data={data}
            onPatch={(patch: DevBotSettingsPatch) => attempt(() => updateDevBotSettings(patch), 'Saved.')}
            onTest={() => attempt(sendDevBotTest, 'Test message sent — check Telegram.')}
          />
        </div>
        <JobsCard
          jobs={data.jobs}
          onCancel={(id) => attempt(() => cancelDevBotJob(id), `Job #${id} cancelled.`)}
          onRetry={(id) => attempt(() => retryDevBotJob(id), 'Queued again for the PC agent.')}
        />
        <MemoryCard
          memories={data.memories ?? []}
          onSave={(m) => attempt(() => saveDevBotMemory(m), m.id ? 'Note updated.' : 'Note added.')}
          onDelete={(id) => attempt(() => deleteDevBotMemory(id), 'Note deleted.')}
        />
        <ActionsCard actions={data.actions} />
      </div>
    </AdminLayout>
  )
}
