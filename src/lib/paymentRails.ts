/**
 * Card payments (Stripe hosted Checkout, 2026-09-30) are offered whenever
 * `/payments/methods` reports `stripe.enabled` — i.e. the server holds BOTH a
 * secret key and a webhook secret for the mode it resolved. The webhook secret
 * is the part that matters: it is the only thing that settles a card payment,
 * so a box without one never shows a button that would charge a card against
 * an invoice nothing will ever mark paid. This flag is only a kill switch, and
 * every card button (pay sheet AND invoice detail page) reads it.
 *
 * Off since 2026-10-02 (owner's call): invoices are paid in USDT-TRC20 only.
 * Stripe stays wired on both sides, so bringing cards back is this flag.
 */
export const CARD_PAYMENTS_ENABLED = false
