/**
 * Which webhook a signal comes in on — the engine has three per exchange:
 * - `main`: the TradingView alerts every customer, the master and staff
 *   trade; announced in the public Telegram / Discord channels.
 * - `test`: separate test webhooks with their own secret, received by
 *   `tester` accounts only; never posted publicly, never billed, and the
 *   master-account rules do not apply.
 * - `submaster`: the sub-master's own webhooks with their own secret,
 *   received by `submaster` accounts only; REAL money, but private like the
 *   test feed (admin Telegram only), never billed.
 *
 * Each own-feed role's accounts follow ONLY that feed, and nobody else's
 * follow it.
 */
export type SignalFeed = 'main' | 'test' | 'submaster'
