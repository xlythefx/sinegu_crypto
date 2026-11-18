import { ArrowRight, Siren } from 'lucide-react'
import { riskAlertCount } from '../../../lib/riskAlerts'
import type { RiskAlert } from '../../../types/riskAlerts'

/**
 * The red caution strip above BOTH Overview views while any high-risk alert
 * is open: how many, and the newest one's title. Clicking it opens Needs
 * attention, where the alerts are listed with their fix links and "Mark
 * resolved". Rendered only when the API sent at least one (collaborators get
 * no list at all).
 */
export default function RiskAlertsStrip({
  alerts,
  onOpen,
}: {
  alerts: RiskAlert[]
  onOpen: () => void
}) {
  const newest = alerts[0]
  if (!newest) return null
  const more = alerts.length - 1

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full cursor-pointer items-center gap-3 rounded-row border border-[color-mix(in_srgb,var(--red)_45%,transparent)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)] px-4 py-3 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--red)_16%,transparent)]"
    >
      <span className="relative grid h-8 w-8 flex-none place-items-center rounded-[10px] bg-red text-white">
        <Siren size={16} aria-hidden="true" />
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-red ring-2 ring-surface" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold text-text">
          {riskAlertCount(alerts.length)} {alerts.length === 1 ? 'needs' : 'need'} you now
        </span>
        <span className="block text-[12.5px] leading-[1.5] text-muted break-words">
          {newest.label}: {newest.title}
          {more > 0 ? ` — and ${more} more` : ''}
        </span>
      </span>
      <span className="inline-flex flex-none items-center gap-1 text-[12.5px] font-bold text-red max-[480px]:hidden">
        Review <ArrowRight size={14} aria-hidden="true" />
      </span>
    </button>
  )
}
