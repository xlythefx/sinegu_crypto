import { CheckCircle2, CircleHelp, CircleSlash, KeyRound, Users } from 'lucide-react'
import ExchangeLogo from '../../exchanges/ExchangeLogo'
import { EXCHANGE_META, type ExchangeMeta } from '../../exchanges/meta'
import StatusChip from './StatusChip'
import UrlRow from './UrlRow'
import { receiversLine, webhookUrl } from '../../../lib/webhooks'
import type { AdminWebhook, AdminWebhooksData } from '../../../types/adminWebhooks'

interface WebhookCardProps {
  webhook: AdminWebhook
  bases: AdminWebhooksData['bases']
}

/** Whether the engine trades this exchange at all — null is "unknown", never "off". */
function VenueChip({ live }: { live: boolean | null }) {
  if (live === true) {
    return (
      <StatusChip tone="good" icon={CheckCircle2}>
        Live on this engine
      </StatusChip>
    )
  }
  if (live === false) {
    return (
      <StatusChip
        tone="neutral"
        icon={CircleSlash}
        title="The engine does not trade this exchange right now — a signal posted here is refused."
      >
        Exchange off on this engine
      </StatusChip>
    )
  }
  return (
    <StatusChip tone="neutral" icon={CircleHelp} title="The engine did not answer, so its live status is unknown.">
      Unknown
    </StatusChip>
  )
}

/** Test feed only: whether the engine has the test secret, i.e. accepts signals here. */
function SecretChip({ enabled }: { enabled: boolean | null }) {
  if (enabled === true) {
    return (
      <StatusChip tone="good" icon={KeyRound}>
        Ready
      </StatusChip>
    )
  }
  if (enabled === false) {
    return (
      <StatusChip
        tone="bad"
        icon={KeyRound}
        title="The engine has no BINANCE_ABCD_TEST_WEBHOOK_SECRET, so it refuses test signals."
      >
        Secret not set
      </StatusChip>
    )
  }
  return null
}

/**
 * One exchange on one feed: which venue, whether the engine is trading it,
 * who it reaches, and the two addresses to post to. Stacks on a phone; on a
 * wide screen the facts sit left of the addresses.
 */
export default function WebhookCard({ webhook, bases }: WebhookCardProps) {
  // A venue the API knows and this build does not still gets a card.
  const meta: ExchangeMeta | undefined = EXCHANGE_META[webhook.exchange]
  const label = meta?.label ?? webhook.exchange
  const nobody = webhook.receivers.live + webhook.receivers.demo === 0

  return (
    <article className="grid min-w-0 grid-cols-1 gap-4 rounded-row border border-border bg-surface p-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] lg:gap-6 max-[480px]:p-3.5">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {meta ? (
            <ExchangeLogo kind={webhook.exchange} size={34} />
          ) : (
            <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-btn border border-border bg-surface2 font-display text-[15px] font-extrabold text-text">
              {label.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <div className="font-display text-[15px] font-extrabold text-text">{label}</div>
            <div className="truncate font-mono text-[11.5px] text-faint">{webhook.path}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <VenueChip live={webhook.venue_live} />
          {webhook.feed === 'test' && <SecretChip enabled={webhook.enabled} />}
        </div>

        <p className={`flex items-start gap-2 text-[12.5px] leading-[1.5] ${nobody ? 'text-faint' : 'text-muted'}`}>
          <Users size={14} className="mt-[2px] flex-none" aria-hidden="true" />
          <span>{receiversLine(webhook.receivers)}</span>
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <UrlRow label="Production" url={webhookUrl(bases.prod, webhook.path)} />
        <UrlRow label="Local" url={webhookUrl(bases.local, webhook.path)} />
      </div>
    </article>
  )
}
