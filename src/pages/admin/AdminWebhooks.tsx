import { Navigate } from 'react-router-dom'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import EngineStatusLine from '../../components/admin/webhooks/EngineStatusLine'
import FeedSection from '../../components/admin/webhooks/FeedSection'
import MessageFieldsCard from '../../components/admin/webhooks/MessageFieldsCard'
import { EXCHANGE_ORDER } from '../../components/exchanges/meta'
import { useApiData } from '../../hooks/useApiData'
import { webhooksFor } from '../../lib/webhooks'
import { getAdminWebhooks } from '../../services/adminWebhooks'
import { ApiError } from '../../services/api'

const TITLE = 'Webhooks'
const SUBTITLE =
  'Where signals are sent. The address decides which exchange trades and which accounts receive it.'

/**
 * Admin → Webhooks: every address the engine takes signals on, with copyable
 * links. Three feeds — main (TradingView → everyone), test (testers only) and
 * sub-master (the sub-master's accounts only, real money) — one card per
 * exchange each, the alert message to paste, and the fields it
 * may carry. Full admins only (not in the collaborator allowlist).
 */
export default function AdminWebhooks() {
  const { data, loading, error, reload } = useApiData(getAdminWebhooks)

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  if (!data) {
    return (
      <AdminLayout title={TITLE} subtitle={SUBTITLE}>
        <DataState loading={loading} error={error} onRetry={reload} label="webhooks" />
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title={TITLE} subtitle={SUBTITLE}>
      <EngineStatusLine reachable={data.engine.reachable} refreshing={loading} onRefresh={reload} />
      <div className="flex flex-col gap-stack">
        <FeedSection feed="main" webhooks={webhooksFor(data.webhooks, 'main', EXCHANGE_ORDER)} data={data} />
        <FeedSection
          feed="test"
          webhooks={webhooksFor(data.webhooks, 'test', EXCHANGE_ORDER)}
          data={data}
          delay={100}
        />
        <FeedSection
          feed="submaster"
          webhooks={webhooksFor(data.webhooks, 'submaster', EXCHANGE_ORDER)}
          data={data}
          delay={150}
        />
        <MessageFieldsCard delay={200} />
      </div>
    </AdminLayout>
  )
}
