import { Navigate, useParams } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import EditorWorkspace from '../../components/admin/creatives/editor/EditorWorkspace'
import DataState from '../../components/dashboard/DataState'
import { useCreativesMeta } from '../../hooks/useCreativesMeta'
import { ApiError } from '../../services/api'

const TITLE = 'Video editor'
const SUBTITLE = 'Scenes on a timeline, captions and sound — one MP4, up to 30 seconds, made in your browser.'

/**
 * Admin → Creatives → one video project's editor (Creatives v2). Same staff
 * group as the rest of Creatives: collaborators (the marketing team) edit
 * here too; only the monthly cap stays full-admin.
 */
export default function AdminCreativeEditor() {
  const { id } = useParams()
  const videoId = Number(id)
  const { meta, budget, setBudget, loading, error, reload } = useCreativesMeta()

  if (error instanceof ApiError && error.status === 401) return <Navigate to="/auth" replace />
  if (!Number.isInteger(videoId) || videoId <= 0) return <Navigate to="/admin/creatives?panel=videos" replace />

  return (
    <AdminLayout title={TITLE} subtitle={SUBTITLE}>
      {!meta || !budget ? (
        <DataState loading={loading} error={error} onRetry={reload} label="Creatives" />
      ) : (
        <EditorWorkspace key={videoId} videoId={videoId} meta={meta} budget={budget} onBudget={setBudget} />
      )}
    </AdminLayout>
  )
}
