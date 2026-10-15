/**
 * Pure helpers for Admin → Webhooks: the address a signal provider posts to,
 * the alert-message template, and the plain sentences the cards print.
 */

import type { SignalFeed } from '../types/feeds'
import type { AdminWebhook, WebhookReceivers } from '../types/adminWebhooks'

/** `base` + `path` with exactly one slash between them. */
export function webhookUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

/**
 * The JSON a TradingView alert's Message box takes, pretty-printed. The
 * secret is a placeholder ON PURPOSE — the real one is never in the browser
 * (this repo is public, and the API does not send it).
 */
export function alertTemplate(feed: SignalFeed): string {
  return JSON.stringify(
    {
      secret: feed === 'test' ? '<paste the test webhook secret>' : '<paste the main webhook secret>',
      action: 'BUY',
      symbol: '{{ticker}}',
      price: '{{close}}',
      leverage: 25,
      strategy: 'ABCD-v1',
    },
    null,
    2,
  )
}

const accounts = (n: number) => (n === 1 ? 'account' : 'accounts')

/** "Sends to 3 real-money and 1 demo account" — or that nobody receives it yet. */
export function receiversLine({ live, demo }: WebhookReceivers): string {
  if (live > 0 && demo > 0) return `Sends to ${live} real-money and ${demo} demo ${accounts(demo)}`
  if (live > 0) return `Sends to ${live} real-money ${accounts(live)}`
  if (demo > 0) return `Sends to ${demo} demo ${accounts(demo)}`
  return 'No accounts receive this yet'
}

/** One feed's webhooks, in the given exchange order (unknown venues last). */
export function webhooksFor(
  all: AdminWebhook[],
  feed: SignalFeed,
  order: readonly string[],
): AdminWebhook[] {
  const rank = (exchange: string) => {
    const i = order.indexOf(exchange)
    return i === -1 ? order.length : i
  }
  return all.filter((w) => w.feed === feed).sort((a, b) => rank(a.exchange) - rank(b.exchange))
}
