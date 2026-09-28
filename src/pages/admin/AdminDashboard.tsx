import type { ComponentType } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BadgeDollarSign,
  LayoutDashboard,
  Server,
  Users,
} from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import Tabs, { type TabItem } from '../../components/ui/Tabs'
import OverviewTab from '../../components/admin/insights/OverviewTab'
import CustomersTab from '../../components/admin/insights/CustomersTab'
import MoneyTab from '../../components/admin/insights/MoneyTab'
import SystemTab from '../../components/admin/insights/SystemTab'
import { useSessionUser } from '../../hooks/useSessionUser'
import { isCollaborator } from '../../lib/roles'

type DashTab = 'overview' | 'customers' | 'money' | 'system'

const TABS: TabItem<DashTab>[] = [
  { key: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { key: 'customers', label: 'Customers', Icon: Users },
  { key: 'money', label: 'Money', Icon: BadgeDollarSign },
  { key: 'system', label: 'System', Icon: Server },
]

/** A read-only collaborator sees the Overview only (the API 403s the rest). */
const COLLABORATOR_TABS: readonly DashTab[] = ['overview']

const PANES: Record<DashTab, ComponentType> = {
  overview: OverviewTab,
  customers: CustomersTab,
  money: MoneyTab,
  system: SystemTab,
}

/**
 * The admin cockpit: one tab per question the owner asks — what needs me,
 * are customers trading, is money coming in, is everything running. The tab
 * lives in `?tab=` so a link or a reload lands on the same one (an old
 * `?tab=master` / `?tab=strategies` link falls back to Overview, as does a
 * tab the viewer's role may not open).
 */
export default function AdminDashboard() {
  const [params, setParams] = useSearchParams()
  const collaborator = isCollaborator(useSessionUser()?.type)
  const tabs = collaborator ? TABS.filter((t) => COLLABORATOR_TABS.includes(t.key)) : TABS
  const raw = params.get('tab')
  const tab: DashTab = tabs.some((t) => t.key === raw) ? (raw as DashTab) : 'overview'
  const Pane = PANES[tab]

  const select = (next: DashTab) =>
    setParams(next === 'overview' ? {} : { tab: next }, { replace: true })

  return (
    <AdminLayout title="Admin Dashboard" subtitle="Structure. Flow. Mastery.">
      <div className="mb-stack">
        <Tabs tabs={tabs} active={tab} onChange={select} label="Dashboard sections" />
      </div>
      {/* keyed re-mount replays the reveal on every tab switch */}
      <div key={tab} className="animate-[fadeup_0.35s_ease-out]">
        <Pane />
      </div>
    </AdminLayout>
  )
}
