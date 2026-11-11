/**
 * The admin's word for an invoice's state.
 *
 * A $0 month (a loss, or still under the high-water mark) is stored `paid` by
 * the API but collected nothing and owes nothing, so it reads "No fee", never
 * "Paid" (2026-11-11 — a list of $0 rows marked Paid read as customers paying).
 * The rows are never deleted: next month's bill reads its high-water mark from
 * them, and the monthly run skips a month that already has one.
 */

export type InvoiceState = 'noFee' | 'paid' | 'overdue' | 'outstanding'

interface InvoiceLike {
  status: string
  totalFee: number
  isOverdue: boolean
}

export function isNoFee(invoice: Pick<InvoiceLike, 'totalFee'>): boolean {
  return invoice.totalFee <= 0
}

export function invoiceState(invoice: InvoiceLike): InvoiceState {
  if (isNoFee(invoice)) return 'noFee'
  if (invoice.status === 'paid') return 'paid'
  return invoice.isOverdue ? 'overdue' : 'outstanding'
}

export const INVOICE_STATE_LABEL: Record<InvoiceState, string> = {
  noFee: 'No fee',
  paid: 'Paid',
  overdue: 'Overdue',
  outstanding: 'Outstanding',
}

/** Pill colours: a $0 month is quiet, never green — nothing was paid. */
export const INVOICE_STATE_PILL: Record<InvoiceState, string> = {
  noFee: 'bg-surface2 text-muted border border-border',
  paid: 'bg-[color-mix(in_srgb,var(--green)_16%,transparent)] text-green',
  overdue: 'bg-[color-mix(in_srgb,var(--red)_16%,transparent)] text-red',
  outstanding: 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-accent',
}
