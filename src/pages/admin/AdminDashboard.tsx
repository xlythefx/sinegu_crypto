import type { ComponentType } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BadgeDollarSign,
  Crown,
  LayoutDashboard,
  Server,
  Target,
  Users,
} from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import Tabs, { type TabItem } from '../../components/ui/Tabs'
import OverviewTab from '../../components/admin/insights/OverviewTab'
import MasterTab from '../../components/admin/insights/MasterTab'
import StrategiesTab from '../../components/admin/insights/StrategiesTab'
import CustomersTab from '../../components/admin/insights/CustomersTab'
import MoneyTab from '../../components/admin/insights/MoneyTab'
import SystemTab from '../../components/admin/insights/SystemTab'

type DashTab = 'overview' | 'master' | 'strategies' | 'customers' | 'money' | 'system'

const TABS: TabItem<DashTab>[] = [
  { key: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { key: 'master', label: 'Master Account', Icon: Crown },
  { key: 'strategies', label: 'Strategies', Icon: Target },
  { key: 'customers', label: 'Customers', Icon: Users },
  { key: 'money', label: 'Money', Icon: BadgeDollarSign },
  { key: 'system', label: 'System', Icon: Server },
]

const PANES: Record<DashTab, ComponentType> = {
  overview: OverviewTab,
  master: MasterTab,
  strategies: StrategiesTab,
  customers: CustomersTab,
  money: MoneyTab,
  system: SystemTab,
}

/**
 * The admin cockpit: one tab per question the owner asks — what needs me,
 * how is the master doing, which strategies work, are customers trading, is
 * money coming in, is everything running. The tab lives in `?tab=` so a
 * link or a reload lands on the same one.
 */
export default function AdminDashboard() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: DashTab = TABS.some((t) => t.key === raw) ? (raw as DashTab) : 'overview'
  const Pane = PANES[tab]

  const select = (next: DashTab) =>
    setParams(next === 'overview' ? {} : { tab: next }, { replace: true })

  return (
    <AdminLayout title="Admin Dashboard" subtitle="Structure. Flow. Mastery.">
      <div className="mb-stack">
        <Tabs tabs={TABS} active={tab} onChange={select} label="Dashboard sections" />
      </div>
      {/* keyed re-mount replays the reveal on every tab switch */}
      <div key={tab} className="animate-[fadeup_0.35s_ease-out]">
        <Pane />
      </div>
    </AdminLayout>
  )
}
