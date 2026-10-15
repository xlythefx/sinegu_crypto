/**
 * Which webhook a signal comes in on — the engine has two per exchange:
 * - `main`: the TradingView alerts every customer, the master and staff
 *   trade; announced in the public Telegram / Discord channels.
 * - `test`: separate test webhooks with their own secret, received by
 *   `tester` accounts only; never posted publicly, never billed, and the
 *   master-account rules do not apply.
 *
 * A tester's accounts follow ONLY the test feed, and nobody else's follow it.
 */
export type SignalFeed = 'main' | 'test'
