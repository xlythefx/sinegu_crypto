import { Navigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import ConnectGrokCard from '../../components/admin/ai-access/ConnectGrokCard'
import HelpCard from '../../components/admin/ai-access/HelpCard'
import KeysCard from '../../components/admin/ai-access/KeysCard'
import QuestionLog from '../../components/admin/ai-access/QuestionLog'
import WhatItReadsCard from '../../components/admin/ai-access/WhatItReadsCard'
import DataState from '../../components/dashboard/DataState'
import { useApiData } from '../../hooks/useApiData'
import { getAiAccess } from '../../services/aiAccess'
import { ApiError } from '../../services/api'

const TITLE = 'AI Access'
const SUBTITLE =
  'Let an AI assistant (Grok) answer questions about signals, trades, assets and billing. Read-only, one key per person.'

/**
 * Admin → AI Access: how to connect Grok, the keys that let it in, what it
 * can read, and every question it asked. Full admins only (not in the
 * collaborator allowlist) — a key reads what an admin reads.
 */
export default function AdminAiAccess() {
  const { data, loading, error, reload } = useApiData(getAiAccess)

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  if (!data) {
    return (
      <AdminLayout title={TITLE} subtitle={SUBTITLE}>
        <DataState loading={loading} error={error} onRetry={reload} label="AI access" />
      </AdminLayout>
    )
  }

  const titles = Object.fromEntries(data.tools.map((t) => [t.name, t.title]))

  return (
    <AdminLayout title={TITLE} subtitle={SUBTITLE}>
      <div className="flex flex-col gap-stack">
        <ConnectGrokCard connector={data.connector} />
        <KeysCard data={data} onChanged={reload} delay={50} />
        <HelpCard delay={100} />
        <QuestionLog titles={titles} delay={150} />
        <WhatItReadsCard tools={data.tools} delay={200} />
      </div>
    </AdminLayout>
  )
}
