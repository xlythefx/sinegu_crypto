import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  FlaskConical,
  Landmark,
  Loader2,
  Receipt,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react'
import DashboardLayout from '../components/dashboard/DashboardLayout'
import DataState from '../components/dashboard/DataState'
import { useInterval } from '../hooks/useInterval'
import { useSessionUser } from '../hooks/useSessionUser'
import { isDeveloper } from '../lib/roles'
import { CARD_PAYMENTS_ENABLED } from '../lib/paymentRails'
import BillingHelpSidebar from '../components/billing/BillingHelpSidebar'
import ExchangeBadge from '../components/billing/ExchangeBadge'
import InvoiceDocumentModal from '../components/billing/InvoiceDocumentModal'
import PaymentMethodModal from '../components/billing/PaymentMethodModal'
import { EXCHANGE_META } from '../components/exchanges/meta'
import { getInvoice } from '../services/billing'
import { createStripeCheckout, getPaymentMethods } from '../services/payments'
import { ApiError, getApiErrorMessage } from '../services/api'
import type { PaymentMethods } from '../types/payments'
import ConfirmModal from '../components/ui/ConfirmModal'
import { hasFee, type Invoice } from '../lib/billing'
import { fmtMoney, fmtSignedMoney, fmtSignedPct, formatDate } from '../lib/format'

/**
 * Stripe's own violet (#635BFF) — a brand colour, like the exchange colours in
 * `exchanges/meta.ts`, so it is fixed rather than a theme token: the card
 * button should read as "Stripe" in both themes. Same size as the crypto one.
 */
const CARD_BTN =
  'flex-1 whitespace-nowrap inline-flex items-center justify-center gap-[9px] rounded-[14px] py-[15px] px-7 text-[14.5px] font-bold cursor-pointer text-white bg-[#635BFF] shadow-[0_12px_28px_-12px_rgba(99,91,255,0.7)] transition-[filter,transform] duration-150 hover:brightness-[1.08] active:translate-y-px disabled:opacity-70 disabled:cursor-wait'

/** The developer-only test-card button: outlined, so it never reads as the real one. */
const CARD_TEST_BTN =
  'w-full inline-flex items-center justify-center gap-2 rounded-[14px] py-[11px] px-6 text-[13px] font-bold cursor-pointer text-[#8b85ff] bg-transparent border border-dashed border-[#635BFF] transition-[background-color] duration-150 hover:bg-[rgba(99,91,255,0.1)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent'

function Tile({
  icon,
  label,
  value,
  tone,
  delay,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone?: 'pos' | 'neg'
  delay: number
}) {
  return (
    <div
      className="rounded-card border border-border bg-surface p-4"
      data-aos="fade-up"
      data-aos-delay={delay}
    >
      <p className="inline-flex items-center gap-[5px] text-[10.5px] uppercase tracking-[0.06em] text-faint mb-2">
        {icon} {label}
      </p>
      <p
        className={`text-[20px] font-bold leading-[1.1] font-mono ${
          tone === 'pos' ? 'text-green' : tone === 'neg' ? 'text-red' : 'text-text'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

export default function InvoiceDetail() {
  const { id } = useParams()
  // A developer's button says which network the payment will run on before it
  // is pressed. Not assumed from the role: TRON follows TRON_DEVELOPER_NETWORK,
  // which is mainnet during a real-money rehearsal, so it is read off the
  // server's own answer (null until it arrives — the button then claims neither).
  const sessionUser = useSessionUser()
  const developer = isDeveloper(sessionUser?.type)
  // Read for everyone: it also decides whether the card button exists (the
  // server offers cards only where a webhook can settle them).
  const [methods, setMethods] = useState<PaymentMethods | null>(null)
  useEffect(() => {
    let cancelled = false
    getPaymentMethods()
      .then((m) => {
        if (!cancelled) setMethods(m)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  const devNetwork = developer ? methods?.tron.network || null : null
  const devTest = developer && devNetwork !== null && devNetwork !== 'mainnet'
  const devReal = developer && devNetwork === 'mainnet'

  // ── card (Stripe hosted checkout) ──────────────────────────────────────
  const cardEnabled = CARD_PAYMENTS_ENABLED && methods?.stripe.enabled === true
  /** Developers only: which card modes they may pick (test card / real charge). */
  const devCardModes = CARD_PAYMENTS_ENABLED ? methods?.stripe.modes : undefined
  const [cardBusy, setCardBusy] = useState<'test' | 'live' | 'default' | null>(null)
  const [cardError, setCardError] = useState<string | null>(null)
  const [confirmLiveCard, setConfirmLiveCard] = useState(false)
  const startCard = useCallback(
    async (mode?: 'test' | 'live') => {
      if (!id) return
      setCardBusy(mode ?? 'default')
      setCardError(null)
      try {
        const session = await createStripeCheckout({ invoiceId: id, mode })
        window.location.href = session.checkoutUrl
      } catch (err) {
        setCardError(getApiErrorMessage(err, 'Could not start the card payment.'))
        setCardBusy(null)
      }
    },
    [id],
  )
  const [searchParams, setSearchParams] = useSearchParams()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [payOpen, setPayOpen] = useState(false)
  /** The printable invoice document (white paper, outside the dark theme). */
  const [docOpen, setDocOpen] = useState(false)
  /** Set when a hosted checkout (Stripe or Coinsbuy) bounced the trader back here. */
  const [returned, setReturned] = useState<'success' | 'cancelled' | null>(null)
  /**
   * Which checkout it was, read off the return URL: Stripe appends
   * `session_id`, Coinsbuy `transaction_id`. A cancel carries neither, so it
   * defaults to card — the only hosted checkout offered while Coinsbuy is
   * hidden (TRON never leaves the page, so it never returns here).
   */
  const [returnedVia, setReturnedVia] = useState<'card' | 'crypto'>('card')
  const [polls, setPolls] = useState(0)

  const load = useCallback(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getInvoice(id ?? '')
      .then((inv) => {
        if (!cancelled) setInvoice(inv)
      })
      .catch((err) => {
        if (!cancelled) setError(err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => load(), [load])

  // Stripe returns to `?payment=success&session_id=…`, Coinsbuy to
  // `…&transaction_id=…` (both to `?payment=cancelled` on a cancel).
  // Read it once, then strip the params so a refresh doesn't replay the banner.
  useEffect(() => {
    const status = searchParams.get('payment')
    if (status !== 'success' && status !== 'cancelled') return
    setReturned(status)
    setReturnedVia(searchParams.has('transaction_id') ? 'crypto' : 'card')
    const next = new URLSearchParams(searchParams)
    next.delete('payment')
    next.delete('transaction_id')
    next.delete('session_id')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  // The redirect only means the trader finished at the gateway — settlement
  // lands on the webhook. Poll for a couple of minutes so the page flips to
  // Paid on its own once the transfer confirms on-chain.
  const settling = returned === 'success' && invoice?.status !== 'paid' && polls < 15
  useInterval(() => {
    setPolls((n) => n + 1)
    load()
  }, settling ? 8000 : null)

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  // Missing / unknown invoice — friendly not-found.
  if (error instanceof ApiError && error.status === 404) {
    return (
      <DashboardLayout title="Invoice">
        <div
          className="rounded-card border border-dashed border-border bg-surface flex flex-col items-center text-center py-14 px-6"
          data-aos="fade-up"
        >
          <FileText size={44} className="text-faint mb-3.5" />
          <h2 className="text-[19px] font-bold mb-1.5">Invoice not found</h2>
          <p className="text-[13px] text-muted mb-5">
            This invoice doesn't exist or is no longer available.
          </p>
          <Link
            to="/dashboard/invoices"
            className="inline-flex items-center gap-[7px] rounded-pill py-2.5 px-5 text-[13px] font-semibold text-on-accent bg-accent"
          >
            <ArrowLeft size={16} /> Back to invoices
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  if (!invoice) {
    return (
      <DashboardLayout title="Invoice">
        <DataState loading={loading} error={error} onRetry={load} label="invoice" />
      </DashboardLayout>
    )
  }

  const paid = invoice.status === 'paid'
  const fee = hasFee(invoice)
  const brand = EXCHANGE_META[invoice.exchange].color

  const statusClass = paid
    ? 'bg-[color-mix(in_srgb,var(--green)_16%,transparent)] text-green'
    : invoice.isOverdue && fee
      ? 'bg-[color-mix(in_srgb,var(--red)_16%,transparent)] text-red'
      : 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-accent'

  return (
    <DashboardLayout title={`Invoice ${invoice.formattedId}`}>
      {/* header */}
      <div
        className="flex items-start justify-between gap-[14px] flex-wrap mb-[22px]"
        data-aos="fade-up"
      >
        <div className="flex items-start gap-[14px] min-w-0">
          <Link
            to="/dashboard/invoices"
            className="grid place-items-center w-10 h-10 flex-shrink-0 rounded-[12px] border border-border bg-surface2 text-text transition-[border-color,transform] duration-150 hover:border-accent hover:-translate-x-0.5"
            aria-label="Back to invoices"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <p className="font-mono text-[11px] tracking-[0.14em] text-accent mb-[5px]">
              {invoice.formattedId}
            </p>
            <h1 className="font-display text-[27px] font-extrabold tracking-[-0.02em] mb-2">
              {invoice.accountName}
            </h1>
            <div className="flex items-center gap-2.5 flex-wrap">
              <ExchangeBadge exchange={invoice.exchange} />
              <span className="text-[13px] text-muted">
                {invoice.monthLabel} billing period
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-2 flex-shrink-0 rounded-pill border border-border bg-surface2 py-2.5 px-[18px] text-[13px] font-semibold text-text cursor-pointer transition-[border-color,transform] duration-150 hover:border-accent hover:-translate-y-px"
          onClick={() => setDocOpen(true)}
        >
          <FileText size={16} className="text-accent" /> View invoice
        </button>
      </div>

      {/* post-checkout banner — settlement itself happens on the webhook */}
      {returned && (
        <div
          className={`relative flex items-start gap-2.5 rounded-card border py-3.5 px-4 pr-11 mb-[18px] animate-[fadeup_0.3s_ease_both] ${
            returned === 'cancelled'
              ? 'border-border bg-surface2'
              : paid
                ? 'border-[color-mix(in_srgb,var(--green)_40%,transparent)] bg-[color-mix(in_srgb,var(--green)_10%,transparent)]'
                : 'border-accent-line bg-accent-soft'
          }`}
          role="status"
        >
          <span
            className={`flex-shrink-0 mt-px ${
              returned === 'cancelled' ? 'text-muted' : paid ? 'text-green' : 'text-accent'
            }`}
          >
            {returned === 'cancelled' ? (
              <Clock size={16} />
            ) : paid ? (
              <CheckCircle2 size={16} />
            ) : (
              <Loader2
                size={16}
                className={settling ? 'animate-[dstate-spin_0.8s_linear_infinite]' : ''}
              />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-bold text-text">
              {returned === 'cancelled'
                ? 'Payment cancelled'
                : paid
                  ? 'Payment confirmed'
                  : returnedVia === 'card'
                    ? 'Payment received — confirming'
                    : 'Payment received — confirming on-chain'}
            </p>
            <p className="text-[12px] text-muted leading-[1.5] mt-0.5">
              {returned === 'cancelled'
                ? `You left the ${returnedVia === 'card' ? 'card' : 'Coinsbuy'} checkout, so nothing was charged. This invoice is still outstanding.`
                : paid
                  ? 'This billing period is settled and your high-water mark has been updated.'
                  : settling
                    ? returnedVia === 'card'
                      ? 'Stripe is confirming your card payment. This page updates automatically — it usually takes a few seconds.'
                      : 'Your transfer is waiting for blockchain confirmation. This page updates automatically — it usually takes a few minutes.'
                    : returnedVia === 'card'
                      ? 'Still not settled. Refresh in a few minutes, or contact support if it persists — please don’t pay a second time.'
                      : 'Still not settled. Confirmation can lag behind the network; refresh in a few minutes or contact support if it persists.'}
            </p>
          </div>
          <button
            type="button"
            className="absolute top-3 right-3 w-7 h-7 grid place-items-center rounded-btn text-faint cursor-pointer transition-colors duration-150 hover:bg-surface2 hover:text-text"
            onClick={() => setReturned(null)}
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-7 items-start max-[1080px]:grid-cols-1">
        <div className="min-w-0 flex flex-col gap-[18px]">
          {/* hero */}
          <section
            className="relative overflow-hidden rounded-card border border-border p-card flex items-center justify-between gap-6 flex-wrap bg-[linear-gradient(150deg,var(--surface),var(--surface2))] animate-[idtPop_0.5s_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[4px] before:bg-[var(--brand,var(--accent))]"
            data-aos="zoom-in"
            style={{ ['--brand' as string]: brand }}
          >
            <div className="min-w-0">
              <span
                className={`inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.06em] py-[3px] px-2.5 rounded-pill mb-3 ${statusClass}`}
              >
                {paid ? (
                  <>
                    <CheckCircle2 size={13} /> Paid
                  </>
                ) : invoice.isOverdue && fee ? (
                  'Overdue'
                ) : (
                  'Outstanding'
                )}
              </span>
              <p className="text-[11px] uppercase tracking-[0.08em] text-faint mb-1">
                {paid ? 'Amount Paid' : 'Amount Due'}
              </p>
              <p className="font-mono text-[42px] font-extrabold leading-none text-text animate-[idtCount_0.5s_cubic-bezier(0.22,1,0.36,1)_both] [animation-delay:120ms] motion-reduce:animate-none">
                {fmtMoney(fee ? invoice.totalFee : 0)}
              </p>
              <p className="inline-flex items-center gap-1.5 text-[12.5px] text-muted mt-3">
                {paid ? (
                  <>
                    <CheckCircle2 size={14} /> Paid on {formatDate(invoice.paidDate)}
                  </>
                ) : (
                  <>
                    <Clock size={14} /> Due by {formatDate(invoice.dueDate)}
                  </>
                )}
              </p>
            </div>

            <div className="flex-shrink-0">
              {!paid && fee ? (
                <div className="flex flex-col items-stretch gap-2 min-w-[230px] max-[640px]:min-w-0">
                  {/* The two ways to pay, side by side (stacked on phones). */}
                  <div className="flex gap-2.5 max-[560px]:flex-col">
                  <button
                    type="button"
                    className="flex-1 whitespace-nowrap inline-flex items-center justify-center gap-[9px] rounded-[14px] py-[15px] px-7 text-[14.5px] font-bold cursor-pointer text-on-accent bg-accent shadow-[0_12px_28px_-12px_var(--glow)] transition-[filter,transform] duration-150 hover:brightness-[1.07] active:translate-y-px"
                    onClick={() => setPayOpen(true)}
                  >
                    {devTest ? <FlaskConical size={18} /> : <Wallet size={18} />}
                    {devTest ? 'Test pay (no real money)' : 'Pay with crypto'}
                  </button>

                  {/* Card: straight to Stripe's hosted checkout. Traders get one
                      button in the box's own mode; developers one per mode they
                      may use, the real charge behind a confirmation. */}
                  {cardEnabled && !devCardModes && (
                    <button
                      type="button"
                      className={CARD_BTN}
                      onClick={() => void startCard()}
                      disabled={cardBusy !== null}
                    >
                      {cardBusy ? <Loader2 size={18} className="animate-[dstate-spin_0.8s_linear_infinite]" /> : <CreditCard size={18} />}
                      {cardBusy ? 'Opening Stripe…' : 'Pay with Stripe'}
                    </button>
                  )}
                  {devCardModes?.live && (
                    <button
                      type="button"
                      className={CARD_BTN}
                      onClick={() => setConfirmLiveCard(true)}
                      disabled={cardBusy !== null}
                    >
                      {cardBusy === 'live' ? <Loader2 size={18} className="animate-[dstate-spin_0.8s_linear_infinite]" /> : <CreditCard size={18} />}
                      {/* Same label a customer sees — the confirmation, not the
                          button, is where a developer is told it is real money. */}
                      {cardBusy === 'live' ? 'Opening Stripe…' : 'Pay with Stripe'}
                    </button>
                  )}
                  </div>
                  {/* Developer-only rehearsal. Always SHOWN to a developer so it
                      is findable; disabled (with the reason) until the test-mode
                      webhook exists, because without it a test payment would
                      never settle. */}
                  {devCardModes && (
                    <>
                      <button
                        type="button"
                        className={CARD_TEST_BTN}
                        onClick={() => void startCard('test')}
                        disabled={cardBusy !== null || !devCardModes.test}
                      >
                        {cardBusy === 'test' ? <Loader2 size={16} className="animate-[dstate-spin_0.8s_linear_infinite]" /> : <FlaskConical size={16} />}
                        {cardBusy === 'test' ? 'Opening Stripe…' : 'Use a Stripe test card'}
                      </button>
                      {!devCardModes.test && (
                        <span className="self-center max-w-[260px] text-center text-[10.5px] text-faint leading-[1.4]">
                          Dev only · needs the Stripe TEST webhook secret on the server
                          (to-do "stripe-register-webhooks").
                        </span>
                      )}
                    </>
                  )}
                  {cardError && (
                    <span className="self-center max-w-[260px] text-center text-[11.5px] font-semibold text-red leading-[1.4]">
                      {cardError}
                    </span>
                  )}

                  {developer && (
                    <span
                      className={`self-center text-center font-mono text-[10.5px] uppercase tracking-[0.08em] ${
                        devReal ? 'text-red' : 'text-accent'
                      }`}
                    >
                      {devReal
                        ? 'Developer · mainnet — real USDT'
                        : devTest
                          ? `Developer · ${devNetwork} testnet`
                          : 'Developer account'}
                    </span>
                  )}
                </div>
              ) : !paid && !fee ? (
                <div className="text-center py-3.5 px-5 rounded-[12px] border border-dashed border-border bg-surface2">
                  <p className="text-[13px] font-semibold text-muted">
                    No profit fees this month
                  </p>
                  <p className="text-[11.5px] text-faint mt-[3px]">
                    Nothing due for this billing period.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-green text-[12px] font-bold uppercase tracking-[0.06em]">
                  <CheckCircle2 size={30} />
                  <span>Settled</span>
                </div>
              )}
            </div>
          </section>

          {/* performance summary tiles */}
          <div className="grid grid-cols-4 gap-3.5 max-[720px]:grid-cols-2">
            <Tile
              icon={<TrendingUp size={13} />}
              label="Performance Gain"
              value={fmtSignedPct(invoice.performanceGain, 2)}
              tone={invoice.performanceGain >= 0 ? 'pos' : 'neg'}
              delay={0}
            />
            <Tile
              icon={<Landmark size={13} />}
              label="Current Balance"
              value={fmtMoney(invoice.currentBalance)}
              delay={60}
            />
            <Tile
              icon={<TrendingUp size={13} />}
              label="Realized P&L"
              value={fmtSignedMoney(invoice.realizedPnl)}
              tone={invoice.realizedPnl >= 0 ? 'pos' : 'neg'}
              delay={120}
            />
            <Tile
              icon={<TrendingUp size={13} />}
              label="Unrealized P&L"
              value={fmtSignedMoney(invoice.unrealizedPnl)}
              tone={invoice.unrealizedPnl >= 0 ? 'pos' : 'neg'}
              delay={180}
            />
          </div>

          {/* HWM progression */}
          <section
            className="rounded-card border border-border bg-surface p-card"
            data-aos="fade-up"
          >
            <p className="inline-flex items-center gap-1.5 text-[10.5px] tracking-[0.14em] text-faint mb-3.5">
              HIGH-WATER MARK
            </p>
            <div className="flex items-stretch gap-3.5 max-[480px]:flex-col">
              <div className="flex-1 border border-border bg-surface2 rounded-[14px] py-4 px-[18px]">
                <span className="block text-[10.5px] uppercase tracking-[0.07em] text-faint mb-1.5">
                  Previous HWM
                </span>
                <span className="text-[22px] font-extrabold text-text font-mono">
                  {invoice.hwmBefore != null ? fmtMoney(invoice.hwmBefore) : '—'}
                </span>
              </div>
              <span className="grid place-items-center text-accent flex-shrink-0 max-[480px]:rotate-90">
                <ArrowRight size={20} />
              </span>
              <div className="flex-1 rounded-[14px] py-4 px-[18px] border border-accent-line bg-[linear-gradient(150deg,var(--accentSoft),var(--surface2))]">
                <span className="block text-[10.5px] uppercase tracking-[0.07em] text-faint mb-1.5">
                  {paid ? 'HWM Set' : 'New HWM'}
                </span>
                <span className="text-[22px] font-extrabold text-accent font-mono">
                  {invoice.hwmAfter != null ? fmtMoney(invoice.hwmAfter) : '—'}
                </span>
              </div>
            </div>
            <p className="text-[12px] text-muted mt-3.5 leading-[1.5]">
              Future fees are charged only on gains above the new high-water mark —
              you never pay twice on the same profit.
            </p>
          </section>

          {/* fee breakdown */}
          <section
            className="rounded-card border border-border bg-surface p-card"
            data-aos="fade-up"
          >
            <p className="inline-flex items-center gap-1.5 text-[10.5px] tracking-[0.14em] text-faint mb-3.5">
              <Receipt size={13} className="text-accent" /> FEE BREAKDOWN
            </p>
            <div className="flex flex-col">
              {invoice.feeSource === 'manual' ? (
                <div className="flex items-center justify-between gap-4 py-3.5 border-b border-hair first:pt-0">
                  <div className="flex flex-col gap-[3px]">
                    <span className="text-[13.5px] font-semibold text-text">Performance fee</span>
                    <span className="text-[11.5px] text-faint font-mono">
                      Set manually for {invoice.monthLabel}
                    </span>
                  </div>
                  <span className="text-[15px] font-bold text-text font-mono">
                    {fmtMoney(invoice.totalFee)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4 py-3.5 border-b border-hair first:pt-0">
                  <div className="flex flex-col gap-[3px]">
                    <span className="text-[13.5px] font-semibold text-text">
                      Realized profit share
                    </span>
                    <span className="text-[11.5px] text-faint font-mono">
                      {invoice.realizedPercent}% of {fmtSignedMoney(invoice.realizedPnl)}
                    </span>
                  </div>
                  <span className="text-[15px] font-bold text-text font-mono">
                    {fmtMoney(invoice.feeRealized)}
                  </span>
                </div>
              )}
              {invoice.feeSource !== 'manual' && invoice.unrealizedPnl !== 0 && (
                <div className="flex items-center justify-between gap-4 py-3.5 border-b border-hair first:pt-0">
                  <div className="flex flex-col gap-[3px]">
                    <span className="text-[13.5px] font-semibold text-text">
                      Unrealized profit share
                    </span>
                    <span className="text-[11.5px] text-faint font-mono">
                      {invoice.unrealizedPercent}% of {fmtSignedMoney(invoice.unrealizedPnl)}
                    </span>
                  </div>
                  <span className="text-[15px] font-bold text-text font-mono">
                    {fmtMoney(invoice.feeUnrealized)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-4 pt-3.5 mt-1">
                <span className="text-[14px] font-bold text-text">
                  {paid ? 'Total paid' : 'Total due'}
                </span>
                <span className="text-[22px] font-extrabold text-accent font-mono">
                  {fmtMoney(invoice.totalFee)}
                </span>
              </div>
            </div>
            {!fee && (
              <p className="text-[12px] text-muted mt-3.5 pt-3.5 border-t border-hair">
                No profit was made this period, so no performance fee is charged.
              </p>
            )}
          </section>

          {/* timeline / reference */}
          <section
            className="rounded-card border border-border bg-surface p-card"
            data-aos="fade-up"
          >
            <p className="inline-flex items-center gap-1.5 text-[10.5px] tracking-[0.14em] text-faint mb-3.5">
              BILLING PERIOD
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 max-[520px]:grid-cols-1">
              <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-hair">
                <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
                  <Calendar size={13} className="text-faint flex-shrink-0" /> Invoice Date
                </span>
                <span className="text-[13px] font-bold text-text font-mono">
                  {formatDate(invoice.invoiceDate)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-hair">
                <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
                  <Clock size={13} className="text-faint flex-shrink-0" /> Due Date
                </span>
                <span className="text-[13px] font-bold text-text font-mono">
                  {formatDate(invoice.dueDate)}
                </span>
              </div>
              {paid && (
                <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-hair">
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
                    <CheckCircle2 size={13} className="text-faint flex-shrink-0" /> Paid Date
                  </span>
                  <span className="text-[13px] font-bold text-green font-mono">
                    {formatDate(invoice.paidDate)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-hair">
                <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
                  <Landmark size={13} className="text-faint flex-shrink-0" />{' '}
                  {invoice.referenceLabel}
                </span>
                <span className="text-[13px] font-bold text-text font-mono">
                  {fmtMoney(invoice.referenceValue)}
                </span>
              </div>
              {invoice.isFirstInvoice && (invoice.depositAmount ?? 0) > 0 && (
                <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-hair">
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
                    <Landmark size={13} className="text-faint flex-shrink-0" /> Initial Deposit
                  </span>
                  <span className="text-[13px] font-bold text-text font-mono">
                    {fmtMoney(invoice.depositAmount!)}
                  </span>
                </div>
              )}
            </div>
          </section>
        </div>

        <BillingHelpSidebar />
      </div>

      <InvoiceDocumentModal
        open={docOpen}
        invoice={invoice}
        customer={sessionUser}
        onClose={() => setDocOpen(false)}
        onPay={() => {
          setDocOpen(false)
          setPayOpen(true)
        }}
      />

      {/* A developer's REAL card charge is real money — confirm it first. */}
      <ConfirmModal
        open={confirmLiveCard}
        title={`Pay ${fmtMoney(invoice.totalFee)} by card`}
        message="You'll be taken to Stripe's secure checkout to complete your payment. Your card details are entered on Stripe and never stored by us."
        confirmLabel="Continue to Stripe"
        cancelLabel="Cancel"
        onConfirm={() => {
          setConfirmLiveCard(false)
          void startCard('live')
        }}
        onCancel={() => setConfirmLiveCard(false)}
      />

      <PaymentMethodModal
        open={payOpen}
        invoice={invoice}
        onClose={() => {
          setPayOpen(false)
          load()
        }}
      />
    </DashboardLayout>
  )
}
