/**
 * Card payments (Stripe hosted Checkout, 2026-09-30) are offered whenever
 * `/payments/methods` reports `stripe.enabled` — i.e. the server holds BOTH a
 * secret key and a webhook secret for the mode it resolved. The webhook secret
 * is the part that matters: it is the only thing that settles a card payment,
 * so a box without one never shows a button that would charge a card against
 * an invoice nothing will ever mark paid. This flag is only a kill switch.
 *
 * WHERE the card is offered (owner, 2026-10-02): ONLY as its own violet
 * "Pay with Stripe" button on the invoice detail page. "Pay with crypto" opens
 * a crypto-only sheet — the two rails are separate buttons, never mixed in one
 * dialog.
 */
export const CARD_PAYMENTS_ENABLED = true
