import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Globe, ShieldAlert, UserPlus } from 'lucide-react'
import Tabs, { type TabItem } from '../../ui/Tabs'
import AttentionPane from './AttentionPane'
import PlatformPane from './PlatformPane'
import { useApiData } from '../../../hooks/useApiData'
import { getOverviewInsights } from '../../../services/adminInsights'

type OverviewView = 'platform' | 'attention'

const VIEWS: TabItem<OverviewView>[] = [
  { key: 'platform', label: 'Platform', Icon: Globe },
  { key: 'attention', label: 'Needs attention', Icon: AlertTriangle },
]

/**
 * Overview: the whole platform pooled (every user combined) and, beside it,
 * what needs a human today. `?view=` holds the sub-tab; it is edited in place
 * so the dashboard's own `?tab=` survives the switch.
 *
 * The overview payload is fetched HERE, not in the pane, because both views
 * read it: Platform raises the "waiting for approval" strip from it and the
 * tab bar badges Needs attention with the same count — one request, so an
 * approval made in the pane clears the strip and the badge together.
 */
export default function OverviewTab({ toolbarSlot }: { toolbarSlot?: HTMLElement | null }) {
  const [params, setParams] = useSearchParams()
  const overview = useApiData(getOverviewInsights)
  const raw = params.get('view')
  const view: OverviewView = VIEWS.some((v) => v.key === raw) ? (raw as OverviewView) : 'platform'
  const pendingCount = overview.data?.attention.pending_users_count ?? 0
  const disputed = overview.data?.attention.disputed_payments ?? 0

  const select = (next: OverviewView) =>
    setParams(
      (p) => {
        const out = new URLSearchParams(p)
        if (next === 'platform') out.delete('view')
        else out.set('view', next)
        return out
      },
      { replace: true },
    )

  const tabs = VIEWS.map((v) => (v.key === 'attention' ? { ...v, badge: pendingCount } : v))
  const viewTabs = <Tabs tabs={tabs} active={view} onChange={select} label="Overview views" />

  return (
    <div className="flex flex-col gap-stack">
      {/* At the right end of the dashboard's tab row when it offers a slot. */}
      {toolbarSlot ? createPortal(viewTabs, toolbarSlot) : viewTabs}
      {/* Above BOTH views: money may be sitting on the wrong invoice. Absent
          for a read-only collaborator (the API omits the count). */}
      {disputed > 0 && (
        <Link
          to="/admin/tron-transfers?status=disputed"
          className="flex w-full items-center gap-3 rounded-row border border-[color-mix(in_srgb,var(--red)_45%,transparent)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)] px-4 py-3 transition-colors hover:bg-[color-mix(in_srgb,var(--red)_16%,transparent)]"
        >
          <span className="relative grid h-8 w-8 flex-none place-items-center rounded-[10px] bg-red text-white">
            <ShieldAlert size={16} />
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-red ring-2 ring-surface" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-semibold text-text">
              {disputed} crypto {disputed === 1 ? 'payment is' : 'payments are'} claimed by two customers
            </span>
            <span className="block text-[12.5px] text-muted">
              One invoice may be paid with someone else&apos;s money. Ask both for their withdrawal record, fix the
              invoices, then mark it resolved.
            </span>
          </span>
          <span className="inline-flex flex-none items-center gap-1 text-[12.5px] font-bold text-red max-[480px]:hidden">
            Review <ArrowRight size={14} />
          </span>
        </Link>
      )}
      {/* keyed re-mount replays the reveal on every switch */}
      <div key={view} className="flex flex-col gap-stack animate-[fadeup_0.35s_ease-out]">
        {view === 'platform' ? (
          <>
            {pendingCount > 0 && (
              <button
                type="button"
                onClick={() => select('attention')}
                className="flex w-full cursor-pointer items-center gap-3 rounded-row border border-accent-line bg-accent-soft px-4 py-3 text-left transition-colors hover:bg-accent/15"
              >
                <span className="relative grid h-8 w-8 flex-none place-items-center rounded-[10px] bg-accent text-on-accent">
                  <UserPlus size={16} />
                  <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-red ring-2 ring-surface" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-text">
                    {pendingCount} new user{pendingCount === 1 ? ' needs' : 's need'} to be approved
                  </span>
                  <span className="block text-[12.5px] text-muted">
                    They cannot use the app until someone approves them. Check these.
                  </span>
                </span>
                <span className="inline-flex flex-none items-center gap-1 text-[12.5px] font-bold text-accent max-[480px]:hidden">
                  Review <ArrowRight size={14} />
                </span>
              </button>
            )}
            <PlatformPane />
          </>
        ) : (
          <AttentionPane {...overview} />
        )}
      </div>
    </div>
  )
}
