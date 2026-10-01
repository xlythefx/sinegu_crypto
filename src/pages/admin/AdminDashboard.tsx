import { useState, type ComponentType } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BadgeDollarSign,
  Crosshair,
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
import OpenPositionsTab from '../../components/admin/insights/OpenPositionsTab'
import { useSessionUser } from '../../hooks/useSessionUser'
import { isCollaborator } from '../../lib/roles'

type DashTab = 'overview' | 'customers' | 'money' | 'system' | 'positions'

const TABS: TabItem<DashTab>[] = [
  { key: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { key: 'customers', label: 'Customers', Icon: Users },
  { key: 'money', label: 'Money', Icon: BadgeDollarSign },
  { key: 'system', label: 'System', Icon: Server },
  { key: 'positions', label: 'Open positions', Icon: Crosshair },
]

/** A read-only collaborator sees the Overview only (the API 403s the rest). */
const COLLABORATOR_TABS: readonly DashTab[] = ['overview']

/** A pane may portal its own sub-tabs into the right end of the tab row. */
export interface DashPaneProps {
  toolbarSlot?: HTMLElement | null
}

const PANES: Record<DashTab, ComponentType<DashPaneProps>> = {
  overview: OverviewTab,
  customers: CustomersTab,
  money: MoneyTab,
  system: SystemTab,
  positions: OpenPositionsTab,
}

/**
 * The admin cockpit: one tab per question the owner asks — what needs me,
 * are customers trading, is money coming in, is everything running, what is
 * open right now. The tab lives in `?tab=` so a link or a reload lands on the
 * same one (an old `?tab=master` / `?tab=strategies` link falls back to
 * Overview, as does a tab the viewer's role may not open).
 */
export default function AdminDashboard() {
  const [params, setParams] = useSearchParams()
  const [toolbarSlot, setToolbarSlot] = useState<HTMLDivElement | null>(null)
  const collaborator = isCollaborator(useSessionUser()?.type)
  const tabs = collaborator ? TABS.filter((t) => COLLABORATOR_TABS.includes(t.key)) : TABS
  const raw = params.get('tab')
  const tab: DashTab = tabs.some((t) => t.key === raw) ? (raw as DashTab) : 'overview'
  const Pane = PANES[tab]

  const select = (next: DashTab) =>
    setParams(next === 'overview' ? {} : { tab: next }, { replace: true })

  return (
    <AdminLayout title="Admin Dashboard" subtitle="Structure. Flow. Mastery.">
      {/* Main tabs on the left; the active pane's own sub-tabs (Overview's
          Platform / Needs attention) are portaled into the right end. On a
          phone the row wraps and the sub-tabs drop under the main ones. */}
      <div className="mb-stack flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={tabs} active={tab} onChange={select} label="Dashboard sections" />
        <div ref={setToolbarSlot} className="flex min-w-0 max-w-full justify-end empty:hidden" />
      </div>
      {/* keyed re-mount replays the reveal on every tab switch */}
      <div key={tab} className="animate-[fadeup_0.35s_ease-out]">
        <Pane toolbarSlot={toolbarSlot} />
      </div>
    </AdminLayout>
  )
}
