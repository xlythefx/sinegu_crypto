import { Radio, TestTubeDiagonal } from 'lucide-react'
import WebhookCard from './WebhookCard'
import AlertMessageCard from './AlertMessageCard'
import { TESTER_TINT } from '../badges'
import type { AdminWebhook, AdminWebhooksData } from '../../../types/adminWebhooks'
import type { SignalFeed } from '../../../types/feeds'

interface FeedSectionProps {
  feed: SignalFeed
  /** This feed's webhooks, already in display order. */
  webhooks: AdminWebhook[]
  data: AdminWebhooksData
  /** AOS stagger for the section's reveal. */
  delay?: number
}

const COPY: Record<SignalFeed, { title: string; lead: string; facts: string[] }> = {
  main: {
    title: 'Main feed',
    lead: 'TradingView → every customer, the master and staff on that exchange.',
    facts: ['Announced in the public Telegram and Discord channels', 'Customers billed as usual'],
  },
  test: {
    title: 'Test feed',
    lead: 'Tester accounts only. Nobody else’s accounts follow it, and testers follow nothing else.',
    facts: ['Never posted to Telegram or Discord', 'Skips the master-account rules', 'Nothing is billed'],
  },
}

const ICON_CHIP: Record<SignalFeed, string> = {
  main: 'bg-accent-soft border-accent-line text-accent',
  test: TESTER_TINT,
}

/** One feed: what it is, one card per exchange, then the alert message. */
export default function FeedSection({ feed, webhooks, data, delay }: FeedSectionProps) {
  const copy = COPY[feed]
  const Icon = feed === 'test' ? TestTubeDiagonal : Radio

  return (
    <section
      className="flex min-w-0 flex-col gap-4 rounded-card border border-border bg-surface p-card max-[480px]:p-3.5"
      data-aos="fade-up"
      data-aos-delay={delay}
      aria-labelledby={`feed-${feed}`}
    >
      <header className="flex items-start gap-3">
        <span
          className={`grid h-9 w-9 flex-none place-items-center rounded-[10px] border ${ICON_CHIP[feed]}`}
          aria-hidden="true"
        >
          <Icon size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`feed-${feed}`} className="font-display text-[16px] font-extrabold text-text">
            {copy.title}
          </h2>
          <p className="mt-0.5 text-[12.5px] leading-[1.55] text-muted">{copy.lead}</p>
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {copy.facts.map((fact) => (
              <li
                key={fact}
                className="rounded-pill border border-hair bg-surface2 px-2.5 py-[3px] text-[11.5px] font-semibold text-muted"
              >
                {fact}
              </li>
            ))}
          </ul>
        </div>
      </header>

      {webhooks.length === 0 ? (
        <p className="rounded-row border border-hair bg-surface2 px-4 py-5 text-center text-[12.5px] text-muted">
          The API listed no webhooks for this feed.
        </p>
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          {webhooks.map((w) => (
            <WebhookCard key={`${w.feed}-${w.exchange}`} webhook={w} bases={data.bases} />
          ))}
        </div>
      )}

      <AlertMessageCard
        feed={feed}
        secretSetOnApi={feed === 'test' ? data.secrets.test_set : data.secrets.main_set}
        engineHasSecret={feed === 'test' ? data.engine.test_feed_enabled : undefined}
      />
    </section>
  )
}
