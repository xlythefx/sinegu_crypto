import { Navigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import CreativesWorkspace from '../../components/admin/creatives/agent/CreativesWorkspace'
import DataState from '../../components/dashboard/DataState'
import { useCreativesMeta } from '../../hooks/useCreativesMeta'
import { ApiError } from '../../services/api'

const TITLE = 'Creatives'
const SUBTITLE =
  'Talk to the Pixel Alpha content agent — ideas, posts and videos of Pixel. Open a panel when you need one.'

/**
 * Admin → Creatives: the marketing team's page — the ONE admin area a
 * collaborator may write in (owner, 2026-11-10). A chat with the content
 * agent, with the former tabs (Plans, Gallery, Pixel, Budget) and the Brief
 * and Memory as panels in `?panel=`; an old `?tab=` link opens the matching
 * panel. Only the monthly cap and the weekly-recap switch are full-admin
 * (`can_edit_budget`).
 */
export default function AdminCreatives() {
  const { meta, budget, setBudget, ai, setAi, loading, error, reload } = useCreativesMeta()

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  if (!meta || !budget || !ai) {
    return (
      <AdminLayout title={TITLE} subtitle={SUBTITLE}>
        <DataState loading={loading} error={error} onRetry={reload} label="Creatives" />
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title={TITLE} subtitle={SUBTITLE}>
      <CreativesWorkspace meta={meta} budget={budget} onBudget={setBudget} ai={ai} onAi={setAi} />
    </AdminLayout>
  )
}
