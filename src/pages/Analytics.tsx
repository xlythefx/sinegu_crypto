import DashboardLayout from '../components/dashboard/DashboardLayout'
import AnalyticsView from '../components/analytics/AnalyticsView'
import { getAnalytics } from '../services/analytics'

export default function Analytics() {
  return (
    <DashboardLayout title="Performance Analytics">
      <AnalyticsView fetchAnalytics={getAnalytics} />
    </DashboardLayout>
  )
}
