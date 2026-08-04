import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import MasterAccountCard from '../../components/admin/MasterAccountCard'
import AdminStatCards from '../../components/admin/AdminStatCards'
import AdminPerformanceChart from '../../components/admin/AdminPerformanceChart'
import PerformanceBreakdown from '../../components/admin/PerformanceBreakdown'
import AdminPnlCalendar from '../../components/admin/AdminPnlCalendar'
import MaintenanceCard from '../../components/admin/MaintenanceCard'
import { useApiData } from '../../hooks/useApiData'
import { getMasterStats } from '../../services/admin'

export default function AdminDashboard() {
  const { data, loading, error, reload } = useApiData(getMasterStats)

  if (!data) {
    return (
      <AdminLayout title="Admin Dashboard" subtitle="Structure. Flow. Mastery.">
        <DataState
          loading={loading}
          error={error}
          onRetry={reload}
          label="master account stats"
        />
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Admin Dashboard" subtitle="Structure. Flow. Mastery.">
      <div className="flex flex-wrap items-stretch gap-stack mb-stack">
        <MasterAccountCard master={data.master} stats={data.stats} />
        <AdminStatCards stats={data.stats} />
      </div>

      <div className="flex flex-wrap items-stretch gap-stack mb-stack">
        <AdminPerformanceChart />
        <PerformanceBreakdown />
      </div>

      <AdminPnlCalendar />

      <div className="flex flex-wrap items-stretch gap-stack mt-stack">
        <MaintenanceCard />
      </div>
    </AdminLayout>
  )
}
