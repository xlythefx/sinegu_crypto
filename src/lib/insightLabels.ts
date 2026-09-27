/**
 * Plain-English names for the reasons the engine records when an account did
 * not take a trade (trading-flask routes/webhook.py). The dashboard shows
 * these to the owner; an unknown reason is shown as the engine wrote it.
 */
const REASONS: Record<string, string> = {
  'api key blocked': 'API key refused by the exchange',
  'deposit below minimum': 'Deposit below the minimum',
  'deposit unknown': 'Deposit not known yet',
  'size too small': 'Balance too small for one trade',
  'maxed sizing': 'Already at the maximum position',
  'stack depth unknown': 'Could not read the open position',
  'order failed': 'Order refused by the exchange',
  position_mode_mismatch: 'Wrong position mode on the exchange',
}

export function reasonLabel(reason: string): string {
  const key = reason.trim().toLowerCase()
  return REASONS[key] ?? reason.charAt(0).toUpperCase() + reason.slice(1)
}

