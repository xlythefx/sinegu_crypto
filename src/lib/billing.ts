/**
 * Billing & Invoices — types, the API→view mapper, and stat helpers.
 * No React here. Live data comes from `services/billing.ts`; the shapes below
 * mirror what `sinegutrade-api` returns from `/invoices`.
 */

import type { ExchangeKind } from '../types/exchanges'
import { fmtMoney } from './format'

export type InvoiceStatus = 'pending' | 'paid'

/** 'pnl' = the fee math; 'manual' = an admin typed the fee (no realized/unrealized split). */
export type InvoiceFeeSource = 'pnl' | 'manual'

/** Fallback fee shares when a period has no profit to derive the rate from. */
export const REALIZED_FEE_PERCENT = 20
export const UNREALIZED_FEE_PERCENT = 6

/** View model the billing UI renders. */
export interface Invoice {
  id: string
  exchange: ExchangeKind
  formattedId: string
  accountName: string
  /** e.g. "June 2026" */
  monthLabel: string
  /** 'YYYY-MM' — the billing month, for matching an invoice to a month's trades. */
  monthYear: string
  invoiceDate: string
  dueDate: string
  paidDate: string | null
  status: InvoiceStatus
  isOverdue: boolean
  totalFee: number
  feeSource: InvoiceFeeSource
  currency: 'USD'
  /** Percentage gain over the reference (HWM / deposit) for the period. */
  performanceGain: number
  currentBalance: number
  hwmBefore: number | null
  hwmAfter: number | null
  realizedPnl: number
  unrealizedPnl: number
  feeRealized: number
  feeUnrealized: number
  /** Effective fee rate applied this period (derived from fee ÷ pnl). */
  realizedPercent: number
  unrealizedPercent: number
  depositAmount?: number
  /**
   * Net money added (+) or taken out (−) during the month. Never billed as
   * profit or counted as a loss: the high-water mark moves by the same amount
   * (2026-11-08), which is why a mark can go DOWN.
   */
  capitalFlow: number
  /**
   * The account value with the month's transfers set aside — what the
   * high-water-mark test compared with `hwmBefore`. Null on an older API.
   */
  performanceEquity: number | null
  /**
   * The month's closed trades BEFORE exchange fees, and those fees; with
   * `realizedPnl` (after fees) they read "before − fees = billed on". Null =
   * not recorded (an older API, or an account whose trades are gone).
   */
  realizedPnlGross: number | null
  exchangeFees: number | null
  isFirstInvoice: boolean
  referenceLabel: string
  referenceValue: number
  /** How a paid invoice was paid: stripe | tron | coinsbuy | manual; null = not paid / not recorded. */
  paymentProvider: string | null
}

/** Raw invoice row as returned by the API (`Invoice::toApiArray`). */
export interface ApiInvoice {
  id: string
  user_id?: string
  exchange: ExchangeKind
  formatted_id: string
  account_name: string
  month_year: string
  month_label: string
  invoice_date: string
  due_date: string
  paid_date: string | null
  status: InvoiceStatus
  is_overdue: boolean
  total_fee: number
  /** Absent from an API older than 2026-09-30 — read as 'pnl'. */
  fee_source?: InvoiceFeeSource
  currency: string
  performance_gain: number
  current_balance: number
  hwm_before: number | null
  hwm_after: number | null
  realized_pnl: number
  unrealized_pnl: number
  fee_realized: number
  fee_unrealized: number
  deposit_amount?: number
  /** Absent from an API older than 2026-11-08 — read as 0. */
  capital_flow?: number
  /** These three are absent from an API older than 2026-11-10. */
  performance_equity?: number | null
  realized_pnl_gross?: number | null
  exchange_fees?: number | null
  is_first_invoice: boolean
  reference_label: string
  reference_value: number
  payment_provider?: string | null
}

/** Map an API invoice row into the UI `Invoice` shape. */
export function mapApiInvoice(row: ApiInvoice): Invoice {
  return {
    id: row.id,
    exchange: row.exchange,
    formattedId: row.formatted_id,
    accountName: row.account_name,
    monthLabel: row.month_label,
    monthYear: row.month_year,
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    paidDate: row.paid_date,
    status: row.status === 'paid' ? 'paid' : 'pending',
    isOverdue: row.is_overdue,
    totalFee: row.total_fee,
    feeSource: row.fee_source === 'manual' ? 'manual' : 'pnl',
    currency: 'USD',
    performanceGain: row.performance_gain,
    currentBalance: row.current_balance,
    hwmBefore: row.hwm_before,
    hwmAfter: row.hwm_after,
    realizedPnl: row.realized_pnl,
    unrealizedPnl: row.unrealized_pnl,
    feeRealized: row.fee_realized,
    feeUnrealized: row.fee_unrealized,
    realizedPercent:
      row.realized_pnl > 0
        ? Math.round((row.fee_realized / row.realized_pnl) * 100)
        : REALIZED_FEE_PERCENT,
    unrealizedPercent:
      row.unrealized_pnl > 0
        ? Math.round((row.fee_unrealized / row.unrealized_pnl) * 100)
        : UNREALIZED_FEE_PERCENT,
    depositAmount: row.deposit_amount,
    capitalFlow: row.capital_flow ?? 0,
    performanceEquity: row.performance_equity ?? null,
    realizedPnlGross: row.realized_pnl_gross ?? null,
    exchangeFees: row.exchange_fees ?? null,
    isFirstInvoice: row.is_first_invoice,
    referenceLabel: row.reference_label,
    referenceValue: row.reference_value,
    paymentProvider: row.payment_provider ?? null,
  }
}

/**
 * One sentence on the month's deposits / withdrawals, or null when no money
 * moved. Shared by the invoice page, the printable document and the admin
 * view so all three say the same thing.
 */
export function capitalFlowNote(inv: Invoice): string | null {
  const flow = Math.round(inv.capitalFlow * 100) / 100
  if (flow === 0) return null
  // fmtMoney prints the absolute value, so the verb carries the direction.
  const moved = flow > 0 ? `added ${fmtMoney(flow)}` : `took out ${fmtMoney(flow)}`
  return `This month you ${moved}. Money you add or take out is not profit or loss, so it was not billed — the high-water mark moved by the same amount.`
}

/** A period earns a fee only when its total fee is positive. */
export const hasFee = (inv: Invoice): boolean => inv.totalFee > 0

/**
 * Whole days from today to an invoice's due date — negative when it is already
 * past due, `null` when the due date can't be parsed.
 */
export function daysUntilDue(inv: Invoice): number | null {
  const due = new Date(`${inv.dueDate.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(due.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / 86_400_000)
}

export interface BillingStats {
  totalPaymentsMade: number
  totalAmountPaid: number
  lastFeePaid: number
  lastPaidMonth: string | null
  outstandingAmount: number
  outstandingCount: number
  currentHWM: number | null
}

export function calculateBillingStats(invoices: Invoice[]): BillingStats {
  const paid = invoices.filter((i) => i.status === 'paid')
  const unpaid = invoices.filter((i) => i.status !== 'paid')

  const last = paid.reduce<Invoice | null>((latest, inv) => {
    const d = inv.paidDate ?? inv.invoiceDate
    const ld = latest ? (latest.paidDate ?? latest.invoiceDate) : ''
    return !latest || d > ld ? inv : latest
  }, null)

  const latestHwm = [...invoices].sort((a, b) =>
    b.invoiceDate.localeCompare(a.invoiceDate)
  )[0]

  return {
    totalPaymentsMade: paid.length,
    totalAmountPaid: paid.reduce((sum, i) => sum + i.totalFee, 0),
    lastFeePaid: last ? last.totalFee : 0,
    lastPaidMonth: last ? last.monthLabel : null,
    outstandingAmount: unpaid.reduce((sum, i) => sum + Math.max(0, i.totalFee), 0),
    outstandingCount: unpaid.filter(hasFee).length,
    currentHWM: latestHwm?.hwmAfter ?? latestHwm?.hwmBefore ?? null,
  }
}
