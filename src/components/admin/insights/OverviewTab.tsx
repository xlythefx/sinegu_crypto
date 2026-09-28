import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, Globe } from 'lucide-react'
import Tabs, { type TabItem } from '../../ui/Tabs'
import AttentionPane from './AttentionPane'
import PlatformPane from './PlatformPane'

type OverviewView = 'platform' | 'attention'

const VIEWS: TabItem<OverviewView>[] = [
  { key: 'platform', label: 'Platform', Icon: Globe },
  { key: 'attention', label: 'Needs attention', Icon: AlertTriangle },
]

const PANES: Record<OverviewView, () => React.JSX.Element> = {
  platform: PlatformPane,
  attention: AttentionPane,
}

/**
 * Overview: the whole platform pooled (every user combined) and, beside it,
 * what needs a human today. `?view=` holds the sub-tab; it is edited in place
 * so the dashboard's own `?tab=` survives the switch.
 */
export default function OverviewTab() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('view')
  const view: OverviewView = VIEWS.some((v) => v.key === raw) ? (raw as OverviewView) : 'platform'
  const Pane = PANES[view]

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

  return (
    <div className="flex flex-col gap-stack">
      <Tabs tabs={VIEWS} active={view} onChange={select} label="Overview views" />
      {/* keyed re-mount replays the reveal on every switch */}
      <div key={view} className="animate-[fadeup_0.35s_ease-out]">
        <Pane />
      </div>
    </div>
  )
}
