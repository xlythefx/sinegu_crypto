import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  CreditCard,
  ExternalLink,
  FlaskConical,
  Landmark,
  Loader2,
  Lock,
  Receipt,
  ShieldCheck,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react'
import CopyState from '../ui/CopyState'
import { fmtMoney, fmtSignedMoney, fmtSignedPct, formatDate } from '../../lib/format'
import { daysUntilDue, type Invoice } from '../../lib/billing'
import {
  FALLBACK_CRYPTOCURRENCIES,
  createCoinsbuyDeposit,
  createTronIntent,
  getPaymentMethods,
} from '../../services/payments'
import { getApiErrorDebug, getApiErrorMessage, type ApiErrorDebug } from '../../services/api'
import { getUser } from '../../lib/session'
import { isDeveloper } from '../../lib/roles'
import type {
  CoinsbuyDeposit,
  PaymentMethods,
  TronIntent,
  TronSettlement,
} from '../../types/payments'
import DevDetails from '../ui/DevDetails'
import ExchangeBadge from './ExchangeBadge'
import TronPayPanel from './TronPayPanel'
import PaymentSuccess from './PaymentSuccess'

/**
 * Card / Stripe payments are hidden until the Stripe flow is switched on — flip
 * this to `true` (and pass `onPayWithCard`) to bring the card option back. The
 * backend endpoint (`/payments/stripe/checkout-session`) already exists.
 */
const CARD_PAYMENTS_ENABLED = false

/**
 * Coinsbuy is hidden from traders (2026-09-23, owner's call): invoices are paid
 * in USDT over TRC-20, straight to our own wallet, with no provider in the
 * middle.
 *
 * A switch rather than a deletion — the provider is still fully wired on both
 * sides (keys, gateway, signed callback, `InvoiceService::settle`), so bringing
 * it back is this flag plus nothing else. Deleting the path would throw away a
 * working fallback for the day the TRON rail needs one.
 *
 * Leaving the ENDPOINT alive is deliberate too: a deposit someone opened before
 * this shipped must still be able to settle on its webhook.
 */
const COINSBUY_ENABLED = false

interface PaymentMethodModalProps {
  open: boolean
  invoice: Invoice | null
  onClose: () => void
  /** Fired once a deposit exists, before the redirect to Coinsbuy. */
  onDepositCreated?: (deposit: CoinsbuyDeposit) => void
  /** Only used while {@link CARD_PAYMENTS_ENABLED} is on. */
  onPayWithCard?: () => void
}

const LABEL = 'text-[10.5px] uppercase tracking-[0.1em] text-faint'
const META_ROW =
  'flex items-center justify-between gap-3 py-2.5 border-b border-hair last:border-b-0'
const META_KEY = 'inline-flex items-center gap-1.5 text-[12px] text-muted min-w-0'
const META_VAL = 'text-[12.5px] font-bold text-text font-mono text-right'

/**
 * Full invoice payment sheet — restates exactly what is being charged (amount,
 * fee breakdown, period, HWM impact), then reserves a USDT amount on TRC-20 and
 * shows the wallet to send it to.
 *
 * Settlement NEVER happens here. The chain watcher matches the amount against
 * the open intent server-side and calls `InvoiceService::settle`; this sheet
 * only polls to notice. (While {@link COINSBUY_ENABLED}, the provider path
 * settles on its signed callback instead — also server-side.)
 */
export default function PaymentMethodModal({
  open,
  invoice,
  onClose,
  onDepositCreated,
  onPayWithCard,
}: PaymentMethodModalProps) {
  const [methods, setMethods] = useState<PaymentMethods | null>(null)
  const [crypto, setCrypto] = useState<string>('USDT')
  const [phase, setPhase] = useState<'idle' | 'creating' | 'redirecting'>('idle')
  const [error, setError] = useState<string | null>(null)
  /** Set only on the Enterprise-wallet path — a bare address to send to. */
  const [deposit, setDeposit] = useState<CoinsbuyDeposit | null>(null)
  /**
   * Which rail the trader picked. Only consulted while {@link COINSBUY_ENABLED}
   * — with Coinsbuy hidden there is nothing to pick, and `provider` below is
   * pinned to 'tron' so no code path can reach the provider by accident.
   */
  const [pickedProvider, setPickedProvider] = useState<'coinsbuy' | 'tron'>('coinsbuy')
  const provider = COINSBUY_ENABLED ? pickedProvider : 'tron'
  /** Set once a TRON amount is reserved — replaces the whole method section. */
  const [tronIntent, setTronIntent] = useState<TronIntent | null>(null)
  /**
   * Set the moment the invoice is actually settled. Replaces the ENTIRE sheet
   * with a confirmation: once the money has landed, restating the fee breakdown
   * and the payment options is noise — the only useful things left are what was
   * paid and where to go next.
   */
  const [settled, setSettled] = useState<TronSettlement | null>(null)
  const [copied, setCopied] = useState(false)
  /** Developer-only: the full failure envelope behind `error`. */
  const [errorDebug, setErrorDebug] = useState<ApiErrorDebug | null>(null)
  /** Developer-only: the non-fatal `/payments/methods` failure, if it failed. */
  const [methodsDebug, setMethodsDebug] = useState<ApiErrorDebug | null>(null)

  /**
   * Read from the stored session, not from `methods.test_account` — the methods
   * call is exactly one of the things that can fail, and a developer must still
   * get the diagnostics when it does. Re-read on each open (below) so a role
   * change mid-tab takes effect without a reload.
   */
  const [developer, setDeveloper] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    // Lock the page behind the sheet so only the sheet scrolls.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  // Fresh state per open, and the provider list straight from the API — the
  // server decides which coins it accepts and whether it is in sandbox mode.
  useEffect(() => {
    if (!open) return
    setPhase('idle')
    setError(null)
    setDeposit(null)
    setPickedProvider('coinsbuy')
    setTronIntent(null)
    setSettled(null)
    setCopied(false)
    setErrorDebug(null)
    setMethodsDebug(null)
    setDeveloper(isDeveloper(getUser()?.type))

    let cancelled = false
    getPaymentMethods()
      .then((m) => {
        if (cancelled) return
        setMethods(m)
        setCrypto(m.coinsbuy.defaultCryptocurrency || 'USDT')
        // The server decides which rail leads; the trader can still switch.
        if (m.defaultProvider === 'tron' && m.tron.visible && m.tron.enabled) {
          setPickedProvider('tron')
        }
      })
      .catch((err: unknown) => {
        // Non-fatal for a trader: fall back to the known coin list and let the
        // deposit call surface any real configuration problem. A developer sees
        // it, because "the coin list is the fallback one" is itself a clue.
        if (!cancelled) setMethodsDebug(getApiErrorDebug(err))
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const startPayment = useCallback(async () => {
    if (!invoice) return
    setPhase('creating')
    setError(null)
    setErrorDebug(null)
    try {
      const created = await createCoinsbuyDeposit({
        invoiceId: invoice.id,
        cryptocurrency: crypto,
        amount: invoice.totalFee,
      })
      onDepositCreated?.(created)

      if (created.paymentType === 'payment_page' && created.paymentUrl) {
        setPhase('redirecting')
        window.location.href = created.paymentUrl
        return
      }
      if (created.destination) {
        setDeposit(created)
        setPhase('idle')
        return
      }
      setError('Coinsbuy did not return a payment link. Please try again.')
      setErrorDebug({
        status: 200,
        errorCode: 'NO_PAYMENT_TARGET',
        message: 'The deposit was created but carried neither a payment_page nor a destination address.',
        detail: created,
      })
      setPhase('idle')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not start the crypto payment.'))
      setErrorDebug(getApiErrorDebug(err))
      setPhase('idle')
    }
  }, [invoice, crypto, onDepositCreated])

  /**
   * Reserve a TRON amount. Unlike the Coinsbuy path this leaves no page — the
   * address and figure render in place — and it makes no outbound call
   * server-side, so it cannot fail on transport.
   */
  const startTronPayment = useCallback(async () => {
    if (!invoice) return
    setPhase('creating')
    setError(null)
    setErrorDebug(null)
    try {
      setTronIntent(await createTronIntent({ invoiceId: invoice.id, amount: invoice.totalFee }))
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not start the crypto payment.'))
      setErrorDebug(getApiErrorDebug(err))
    } finally {
      setPhase('idle')
    }
  }, [invoice])

  const copyAddress = useCallback(async () => {
    if (!deposit?.destination) return
    try {
      await navigator.clipboard.writeText(deposit.destination)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy the address — select it and copy manually.')
    }
  }, [deposit])

  if (!open || !invoice) return null

  const days = daysUntilDue(invoice)
  const overdue = invoice.isOverdue || (days != null && days < 0)
  const dueText =
    days == null
      ? null
      : days < 0
        ? `Overdue by ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'}`
        : days === 0
          ? 'Due today'
          : `Due in ${days} ${days === 1 ? 'day' : 'days'}`

  const coins = methods?.coinsbuy.cryptocurrencies?.length
    ? methods.coinsbuy.cryptocurrencies
    : FALLBACK_CRYPTOCURRENCIES
  const cryptoEnabled = methods ? methods.coinsbuy.enabled : true
  const sandbox = methods?.coinsbuy.mode === 'sandbox'
  // Developer account: test credentials on every machine, including production.
  const testAccount = methods?.testAccount === true
  const busy = phase !== 'idle'

  /**
   * Whether to offer the direct-wallet rail at all. The server is the authority
   * — it 404s the endpoint for anyone who should not see it — so this is only
   * about not rendering a button that would fail.
   */
  const tronVisible = methods?.tron.visible === true && methods.tron.enabled
  const tronIsTestnet = tronVisible && methods.tron.network !== 'mainnet'
  const payDisabled = provider === 'tron' ? !tronVisible : !cryptoEnabled
  /**
   * Whether this sheet is about to move REAL money. With Coinsbuy hidden, the
   * provider's own sandbox flag says nothing — what decides it is the chain the
   * address lives on.
   */
  const testMode = testAccount || (COINSBUY_ENABLED ? sandbox : tronIsTestnet)
  /** No rail left to offer: say so instead of rendering an empty "Pay with". */
  const noRail = !tronVisible && (!COINSBUY_ENABLED || !cryptoEnabled)

  // Once the invoice is settled the sheet has one job left: confirm what was
  // paid and offer somewhere to go. Everything above it — the fee breakdown,
  // the payment options — is now describing a decision already made.
  if (settled) {
    return createPortal(
      <PaymentSuccess
        invoice={invoice}
        settlement={settled}
        onDone={onClose}
      />,
      document.body,
    )
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex justify-center overflow-y-auto p-4 max-[420px]:p-3 sm:p-6 bg-[var(--bgScrim)] backdrop-blur-[4px] animate-[fadeup_0.2s_ease_both]"
      onClick={busy ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Pay invoice ${invoice.formattedId}`}
    >
      <div
        className="relative w-full max-w-[540px] my-auto flex flex-col max-h-[calc(100vh-2rem)] bg-surface border border-border rounded-[20px] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.4)] animate-[fadeup_0.28s_cubic-bezier(0.2,0.7,0.2,1)_both]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── header ────────────────────────────────────────────── */}
        <header className="flex-shrink-0 flex gap-3 items-start p-5 pr-14 max-[420px]:p-4 max-[420px]:pr-12 border-b border-hair">
          <span className="w-[38px] h-[38px] flex-shrink-0 grid place-items-center rounded-[11px] bg-[var(--bubble)] border border-accent-line text-accent">
            <Lock size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-[18px] font-extrabold tracking-[-0.01em] leading-tight flex items-center gap-2 flex-wrap">
              Pay with crypto
              {testMode && (
                <span className="font-body text-[9.5px] font-bold uppercase tracking-[0.06em] py-[3px] px-2 rounded-pill bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-accent">
                  Test mode
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2 flex-wrap mt-1.5">
              <span className="font-mono text-[11px] text-accent tracking-[0.08em]">
                {invoice.formattedId}
              </span>
              <ExchangeBadge exchange={invoice.exchange} />
              <span className="text-[11.5px] text-muted">
                {invoice.monthLabel} · {invoice.accountName}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="absolute top-4 right-4 w-8 h-8 grid place-items-center rounded-btn bg-transparent text-faint cursor-pointer transition-colors duration-150 hover:bg-surface2 hover:text-text disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        {/* ── body ──────────────────────────────────────────────── */}
        <div className="min-h-0 overflow-y-auto p-5 max-[420px]:p-4 flex flex-col gap-[18px]">
          {testAccount && (
            <p className="flex items-start gap-2 text-[12px] font-semibold text-accent rounded-[12px] border border-accent-line bg-accent-soft py-2.5 px-3.5 leading-[1.45]">
              <FlaskConical size={15} className="flex-shrink-0 mt-px" />
              Developer account — this is a TEST payment. It runs the real
              checkout and the real webhook against the provider's sandbox, so
              no money moves and the invoice settles with test funds.
            </p>
          )}

          {/* The wiring, before anything has failed: which keys are set, where
              the callbacks point, why this box picked this mode. */}
          {developer && methods?.debug && (
            <DevDetails
              title="Payment config"
              defaultOpen={false}
              className=""
              debug={{
                status: 200,
                errorCode: methods.coinsbuy.mode,
                message: `environment ${methods.environment} · coinsbuy ${methods.coinsbuy.mode} · stripe ${methods.stripe.mode}`,
                detail: methods.debug,
              }}
            />
          )}

          {overdue && (
            <p className="flex items-start gap-2 text-[12px] font-semibold text-red rounded-[12px] border border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_12%,transparent)] py-2.5 px-3.5 leading-[1.45]">
              <AlertTriangle size={15} className="flex-shrink-0 mt-px" />
              This billing period is past due — trading stays paused on this
              account until the payment clears.
            </p>
          )}

          {/* amount due */}
          <section className="rounded-[14px] border border-accent-line bg-[linear-gradient(150deg,var(--accentSoft),var(--surface2))] p-[18px] max-[420px]:p-4">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <span className={LABEL}>Amount due</span>
              {dueText && (
                <span
                  className={`text-[10.5px] font-bold uppercase tracking-[0.06em] py-[3px] px-2.5 rounded-pill ${
                    overdue
                      ? 'bg-[color-mix(in_srgb,var(--red)_16%,transparent)] text-red'
                      : 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-accent'
                  }`}
                >
                  {dueText}
                </span>
              )}
            </div>
            <p className="font-mono text-[38px] max-[420px]:text-[31px] font-extrabold leading-none text-text animate-[idtCount_0.45s_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none">
              {fmtMoney(invoice.totalFee)}
            </p>
            <p className="flex items-center gap-1.5 flex-wrap text-[12px] text-muted mt-2.5">
              <CalendarDays size={13} className="text-faint flex-shrink-0" />
              Due by {formatDate(invoice.dueDate)}
              <span className="text-faint">·</span>
              Invoiced {formatDate(invoice.invoiceDate)}
            </p>
          </section>

          {/* what you're paying for */}
          <section>
            <p className={`${LABEL} flex items-center gap-1.5 mb-2.5`}>
              <Receipt size={13} className="text-accent" /> What you're paying for
            </p>
            <div className="rounded-[14px] border border-border bg-surface2 py-1 px-4 max-[420px]:px-3.5">
              {invoice.feeSource === 'manual' ? (
                <div className="flex items-center justify-between gap-4 py-3 border-b border-hair">
                  <div className="flex flex-col gap-[3px] min-w-0">
                    <span className="text-[13px] font-semibold text-text">Performance fee</span>
                    <span className="text-[11px] text-faint font-mono">
                      Set manually for {invoice.monthLabel}
                    </span>
                  </div>
                  <span className="text-[14px] font-bold text-text font-mono flex-shrink-0">
                    {fmtMoney(invoice.totalFee)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4 py-3 border-b border-hair">
                  <div className="flex flex-col gap-[3px] min-w-0">
                    <span className="text-[13px] font-semibold text-text">
                      Realized profit share
                    </span>
                    <span className="text-[11px] text-faint font-mono">
                      {invoice.realizedPercent}% of{' '}
                      {fmtSignedMoney(invoice.realizedPnl)} closed P&amp;L
                    </span>
                  </div>
                  <span className="text-[14px] font-bold text-text font-mono flex-shrink-0">
                    {fmtMoney(invoice.feeRealized)}
                  </span>
                </div>
              )}

              {invoice.feeSource !== 'manual' && invoice.unrealizedPnl !== 0 && (
                <div className="flex items-center justify-between gap-4 py-3 border-b border-hair">
                  <div className="flex flex-col gap-[3px] min-w-0">
                    <span className="text-[13px] font-semibold text-text">
                      Unrealized profit share
                    </span>
                    <span className="text-[11px] text-faint font-mono">
                      {invoice.unrealizedPercent}% of{' '}
                      {fmtSignedMoney(invoice.unrealizedPnl)} open P&amp;L
                    </span>
                  </div>
                  <span className="text-[14px] font-bold text-text font-mono flex-shrink-0">
                    {fmtMoney(invoice.feeUnrealized)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between gap-4 py-3.5">
                <span className="text-[13.5px] font-bold text-text">Total due</span>
                <span className="text-[19px] font-extrabold text-accent font-mono">
                  {fmtMoney(invoice.totalFee)}{' '}
                  <span className="text-[11px] font-bold text-faint">USD</span>
                </span>
              </div>
            </div>
          </section>

          {/* period + account detail */}
          <section>
            <p className={`${LABEL} flex items-center gap-1.5 mb-2.5`}>
              <TrendingUp size={13} className="text-accent" /> This billing period
            </p>
            <div className="rounded-[14px] border border-border bg-surface2 py-1 px-4 max-[420px]:px-3.5 grid grid-cols-2 gap-x-6 max-[520px]:grid-cols-1">
              <div className={META_ROW}>
                <span className={META_KEY}>
                  <CalendarDays size={13} className="text-faint flex-shrink-0" />
                  Period
                </span>
                <span className={META_VAL}>{invoice.monthLabel}</span>
              </div>
              <div className={META_ROW}>
                <span className={META_KEY}>
                  <TrendingUp size={13} className="text-faint flex-shrink-0" />
                  Performance
                </span>
                <span
                  className={`${META_VAL} ${
                    invoice.performanceGain >= 0 ? 'text-green' : 'text-red'
                  }`}
                >
                  {fmtSignedPct(invoice.performanceGain, 2)}
                </span>
              </div>
              <div className={META_ROW}>
                <span className={META_KEY}>
                  <Landmark size={13} className="text-faint flex-shrink-0" />
                  Balance
                </span>
                <span className={META_VAL}>{fmtMoney(invoice.currentBalance)}</span>
              </div>
              <div className={META_ROW}>
                <span className={META_KEY}>
                  <ArrowRight size={13} className="text-faint flex-shrink-0" />
                  New HWM
                </span>
                <span className={`${META_VAL} text-accent`}>
                  {invoice.hwmAfter != null ? fmtMoney(invoice.hwmAfter) : '—'}
                </span>
              </div>
            </div>
            <p className="text-[11.5px] text-muted leading-[1.5] mt-2.5">
              Paying sets your high-water mark to{' '}
              {invoice.hwmAfter != null ? fmtMoney(invoice.hwmAfter) : 'the new level'} —
              future fees are only charged on gains above it, so you never pay
              twice on the same profit.
            </p>
          </section>

          {/* payment method */}
          <section>
            <p className={`${LABEL} flex items-center gap-1.5 mb-2.5`}>
              <Wallet size={13} className="text-accent" /> Pay with
            </p>

            {tronIntent ? (
              /* Direct wallet: the address and the exact figure, in place. */
              <TronPayPanel
                intent={tronIntent}
                developer={developer}
                onSettled={setSettled}
              />
            ) : deposit ? (
              /* Enterprise-wallet fallback: no hosted page, just an address. */
              <div className="rounded-[14px] border border-accent bg-accent-soft p-4 max-[420px]:p-3.5">
                <p className="text-[13.5px] font-bold text-text mb-1">
                  Send {deposit.cryptocurrency} to this address
                </p>
                <p className="text-[11.5px] text-muted leading-[1.5] mb-3">
                  Transfer the equivalent of {fmtMoney(deposit.amount)}{' '}
                  {deposit.currency}. The invoice settles automatically once the
                  transfer confirms on-chain.
                </p>
                <div className="flex items-center gap-2 rounded-[10px] border border-accent-line bg-surface2 py-2.5 px-3">
                  <code className="flex-1 min-w-0 font-mono text-[11.5px] text-text break-all">
                    {deposit.destination}
                  </code>
                  <button
                    type="button"
                    className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-btn border border-border bg-surface py-1.5 px-2.5 text-[11.5px] font-bold text-text cursor-pointer transition-[border-color] duration-150 hover:border-accent"
                    onClick={copyAddress}
                  >
                    <CopyState copied={copied} />
                  </button>
                </div>
              </div>
            ) : (
              <>
              {COINSBUY_ENABLED && (
              <div
                className={`rounded-[14px] border p-4 max-[420px]:p-3.5 transition-[border-color] duration-150 ${
                  provider === 'coinsbuy'
                    ? 'border-accent bg-accent-soft'
                    : 'border-border bg-surface2'
                }`}
                role={tronVisible ? 'button' : undefined}
                tabIndex={tronVisible && provider !== 'coinsbuy' ? 0 : undefined}
                onClick={tronVisible && provider !== 'coinsbuy' ? () => setPickedProvider('coinsbuy') : undefined}
              >
                <div className="flex items-center gap-3 mb-3.5">
                  <span className="w-9 h-9 flex-shrink-0 grid place-items-center rounded-[10px] bg-[var(--bubble)] border border-accent-line text-accent">
                    <Wallet size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-bold text-text">
                      Crypto via Coinsbuy
                    </p>
                    <p className="text-[11.5px] text-muted">
                      Choose a coin — the checkout opens on Coinsbuy.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cryptocurrency">
                  {coins.map((coin) => (
                    <button
                      key={coin}
                      type="button"
                      role="radio"
                      aria-checked={crypto === coin}
                      disabled={busy || !cryptoEnabled}
                      className={`inline-flex items-center gap-1.5 rounded-pill border py-2 px-3.5 font-mono text-[12px] font-bold cursor-pointer transition-[border-color,background-color,color] duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
                        crypto === coin
                          ? 'bg-accent border-accent text-on-accent'
                          : 'border-border bg-surface2 text-muted hover:border-accent hover:text-text'
                      }`}
                      onClick={() => setCrypto(coin)}
                    >
                      {crypto === coin && <Check size={12} strokeWidth={3} />}
                      {coin}
                    </button>
                  ))}
                </div>

                <p className="text-[11.5px] text-muted leading-[1.5] mt-3 pt-3 border-t border-accent-line">
                  You'll be redirected to Coinsbuy's secure checkout, which shows
                  the exact coin amount and deposit address. The invoice settles
                  automatically once the transfer confirms on-chain.
                </p>
              </div>
              )}

              {/* Direct wallet — no provider in the middle. Hidden entirely
                  until the server says this caller may see it. */}
              {tronVisible && (
                <div
                  className={`rounded-[14px] border p-4 max-[420px]:p-3.5 transition-[border-color] duration-150 ${
                    COINSBUY_ENABLED ? 'mt-2.5 cursor-pointer' : ''
                  } ${
                    provider === 'tron'
                      ? 'border-accent bg-accent-soft'
                      : 'border-border bg-surface2 hover:border-accent'
                  }`}
                  role={COINSBUY_ENABLED ? 'button' : undefined}
                  tabIndex={COINSBUY_ENABLED ? 0 : undefined}
                  onClick={COINSBUY_ENABLED ? () => setPickedProvider('tron') : undefined}
                  onKeyDown={(e) => {
                    if (COINSBUY_ENABLED && (e.key === 'Enter' || e.key === ' ')) {
                      setPickedProvider('tron')
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 flex-shrink-0 grid place-items-center rounded-[10px] border border-accent-line bg-[var(--bubble)] text-accent">
                      <Landmark size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      {/* The chain label already carries its own parentheses
                          ("TRC-20 (TRON Nile testnet)"), so wrapping it in more
                          nests them. */}
                      <p className="flex items-center gap-2 text-[13.5px] font-bold text-text">
                        Direct {methods?.tron.asset ?? 'USDT'} ·{' '}
                        {methods?.tron.chainLabel ?? 'TRC-20'}
                        {tronIsTestnet && (
                          <span className="inline-flex items-center gap-1 rounded-pill border border-accent-line bg-[var(--bubble)] py-0.5 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-accent">
                            <FlaskConical size={10} /> Test net
                          </span>
                        )}
                      </p>
                      <p className="text-[11.5px] text-muted">
                        Send straight to our wallet — no provider, no redirect.
                      </p>
                    </div>
                    {COINSBUY_ENABLED && provider === 'tron' && (
                      <Check size={16} strokeWidth={3} className="flex-shrink-0 text-accent" />
                    )}
                  </div>
                </div>
              )}
              </>
            )}

            {noRail && (
              <p className="flex items-start gap-2 text-[11.5px] font-semibold text-red mt-2.5">
                <AlertTriangle size={13} className="flex-shrink-0 mt-px" />
                Crypto payments are not configured on this server yet.
              </p>
            )}

            {CARD_PAYMENTS_ENABLED ? (
              <button
                type="button"
                className="w-full mt-2.5 flex items-center gap-3 text-left rounded-[14px] border border-border bg-surface2 p-4 cursor-pointer transition-[border-color] duration-150 hover:border-accent"
                onClick={onPayWithCard}
              >
                <span className="w-9 h-9 flex-shrink-0 grid place-items-center rounded-[10px] border border-border bg-surface text-muted">
                  <CreditCard size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-bold text-text">Card</span>
                  <span className="block text-[11.5px] text-muted">
                    Processed securely via Stripe.
                  </span>
                </span>
              </button>
            ) : (
              <p className="flex items-center gap-2 text-[11.5px] text-faint mt-2.5">
                <CreditCard size={13} className="flex-shrink-0" />
                Card payments are coming soon — crypto is the only method for now.
              </p>
            )}

            {error && (
              <p className="flex items-start gap-2 text-[12px] font-semibold text-red rounded-[12px] border border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-[color-mix(in_srgb,var(--red)_12%,transparent)] py-2.5 px-3.5 leading-[1.45] mt-2.5">
                <AlertTriangle size={15} className="flex-shrink-0 mt-px" />
                {error}
              </p>
            )}

            {/* Developer accounts get the whole failure, not the polite version:
                which stage broke, what the provider said, what to check. */}
            {developer && errorDebug && (
              <DevDetails title="Crypto payment failed" debug={errorDebug} />
            )}
            {developer && methodsDebug && (
              <DevDetails
                title="/payments/methods failed — coin list is the fallback"
                debug={methodsDebug}
                defaultOpen={false}
              />
            )}
          </section>
        </div>

        {/* ── footer ────────────────────────────────────────────── */}
        <footer className="flex-shrink-0 border-t border-hair bg-surface p-5 max-[420px]:p-4">
          <p className="flex items-start gap-2 text-[11.5px] text-muted leading-[1.45] mb-3.5">
            <ShieldCheck size={14} className="text-accent flex-shrink-0 mt-px" />
            Payments are one-off — we never hold your funds and your exchange API
            keys stay trade-only.
          </p>
          <div className="flex gap-2.5 justify-end max-[430px]:flex-col-reverse">
            <button
              type="button"
              className="text-[13.5px] font-semibold bg-surface2 text-text border border-border py-3 px-[22px] rounded-pill cursor-pointer transition-[border-color] duration-150 hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed max-[430px]:w-full"
              onClick={onClose}
              disabled={busy}
            >
              {deposit || tronIntent ? 'Done' : 'Cancel'}
            </button>
            {!deposit && !tronIntent && (
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 text-[13.5px] font-bold bg-accent text-on-accent border-0 py-3 px-[22px] rounded-pill cursor-pointer shadow-[0_10px_24px_var(--glow)] transition-[filter,transform] duration-150 hover:brightness-[1.06] active:translate-y-px disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none max-[430px]:w-full"
                onClick={provider === 'tron' ? startTronPayment : startPayment}
                disabled={busy || payDisabled}
                autoFocus
              >
                {phase === 'idle' ? (
                  provider === 'tron' ? (
                    <>
                      {testAccount ? <FlaskConical size={16} /> : <Landmark size={16} />}
                      Show payment address
                    </>
                  ) : (
                    <>
                      {testAccount ? <FlaskConical size={16} /> : <ExternalLink size={16} />}
                      {testAccount ? 'Test pay' : 'Pay'} {fmtMoney(invoice.totalFee)} with{' '}
                      {crypto}
                    </>
                  )
                ) : (
                  <>
                    <Loader2 size={16} className="animate-[dstate-spin_0.8s_linear_infinite]" />
                    {provider === 'tron'
                      ? 'Reserving amount…'
                      : phase === 'creating'
                        ? 'Opening checkout…'
                        : 'Redirecting…'}
                  </>
                )}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
