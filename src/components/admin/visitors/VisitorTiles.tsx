import { Percent, Radio, UserPlus, Users } from 'lucide-react'
import MetricTile from '../../analytics/MetricTile'
import { TILES } from '../insights/parts'
import type { VisitorSummary } from '../../../types/visitors'

/** The four headline numbers for the period, plus who is on the site right now. */
export default function VisitorTiles({ totals }: { totals: VisitorSummary['totals'] }) {
  return (
    <div className={TILES}>
      <MetricTile
        label="Visitors"
        icon={Users}
        value={totals.visitors.toLocaleString()}
        sub={`${totals.views.toLocaleString()} page views`}
        tooltip="Different people per day. Someone who comes back on another day counts again."
      />
      <MetricTile
        label="Sign-ups"
        icon={UserPlus}
        value={totals.signups.toLocaleString()}
        sub="new customer accounts"
      />
      <MetricTile
        label="Sign-up rate"
        icon={Percent}
        value={totals.signup_rate === null ? '—' : `${totals.signup_rate}%`}
        sub="of visitors created an account"
      />
      <MetricTile
        label="On the site now"
        icon={Radio}
        iconTone={totals.live_now > 0 ? 'pos' : 'accent'}
        value={totals.live_now.toLocaleString()}
        sub="in the last 5 minutes"
      />
    </div>
  )
}
