import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileText,
  PenLine,
  Receipt,
  TrendingUp,
} from 'lucide-react'
import { createManualInvoice, generateInvoices, updateInvoice } from '../../services/admin'
import { getApiErrorMessage } from '../../services/api'
import { fmtMoney, prevMonth } from '../../lib/format'
import { useSessionUser } from '../../hooks/useSessionUser'
import ConfirmModal from '../ui/ConfirmModal'
import Tabs, { type TabItem } from '../ui/Tabs'
import type { Invoice } from '../../lib/billing'
import type { AdminUser } from '../../types/admin'

/* ---- token-mapped class strings (mirrors AdminSandbox / billing/InvoiceCard) ---- */
const CHIP =
  'w-7 h-7 flex-none grid place-items-center rounded-[9px] bg-accent-soft border border-accent-line text-accent'
const MSG_ERR =
  'flex items-start gap-2 rounded-[10px] border py-2.5 px-[13px] text-[12.5px] leading-[1.5] border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] text-red'
const INV_INPUT =
  'h-10 rounded-[10px] border border-border bg-surface2 text-text px-3 text-[13px] font-body'
const SELECT = `${INV_INPUT} cursor-pointer [&>option]:bg-surface [&>option]:text-text`
const FIELD_LABEL = 'text-[11px] uppercase tracking-[0.06em] text-faint'
const BTN =
  'inline-flex items-center gap-[7px] h-10 rounded-pill border border-transparent px-[18px] text-[13px] font-bold cursor-pointer transition-[filter,border-color,background,opacity] duration-150 disabled:opacity-[0.55] disabled:cursor-not-allowed'
const BTN_PRIMARY = 'bg-accent border-transparent text-on-accent enabled:hover:brightness-[1.06]'
const BTN_SM = 'h-8 px-3 text-[12px]'

type Mode = 'pnl' | 'manual'

const MODES: TabItem<Mode>[] = [
  { key: 'pnl', label: 'From P&L', Icon: TrendingUp },
  { key: 'manual', label: 'Manual fee', Icon: PenLine },
]

/**
 * Manual invoice workflow for the admin sandbox. Two modes:
 * - From P&L: pick a user + month, generate from their closed P&L (every
 *   account of theirs), preview the fees/HWM, and settle it by hand.
 * - Manual fee: pick ONE account + month and type the fee — a one-off charge,
 *   or a real payment test at a chosen amount. It replaces that month's unpaid
 *   invoice; the API refuses one that was paid.
 */
export default function SandboxInvoiceCard({ users }: { users: AdminUser[] }) {
  const me = useSessionUser()
  const [mode, setMode] = useState<Mode>('pnl')
  const [uniId, setUniId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [month, setMonth] = useState(prevMonth())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [preview, setPreview] = useState<Invoice[] | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  // Manual invoices are Binance-only (the API's rule) and never on a
  // disconnected account.
  const accounts = useMemo(
    () =>
      (users.find((u) => u.uni_id === uniId)?.accounts ?? []).filter(
        (a) => a.exchange === 'binance' && !a.deleted_at,
      ),
    [users, uniId],
  )
  const account = accounts.find((a) => String(a.id) === accountId)
  const fee = Number(amount)
  const feeValid = amount.trim() !== '' && Number.isFinite(fee) && fee >= 0.01

  const pickUser = (id: string) => {
    setUniId(id)
    const binance = (users.find((u) => u.uni_id === id)?.accounts ?? []).filter(
      (a) => a.exchange === 'binance' && !a.deleted_at,
    )
    // One account is the common case — pick it rather than make them.
    setAccountId(binance.length === 1 ? String(binance[0].id) : '')
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setErr(null)
    setPreview(null)
  }

  const generate = async () => {
    if (!uniId) {
      setErr('Pick a user first.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const created = await generateInvoices({
        uni_id: uniId,
        month_year: month,
        invoice_demo: true,
      })
      setPreview(created)
      if (created.length === 0) {
        setErr('No invoices generated — that user has no exchange accounts.')
      }
    } catch (e) {
      setErr(getApiErrorMessage(e, 'Could not generate invoices.'))
    } finally {
      setBusy(false)
    }
  }

  const askManual = () => {
    if (!uniId) return setErr('Pick a user first.')
    if (!account) return setErr('Pick the Binance account to bill.')
    if (!feeValid) return setErr('Enter a fee of at least $0.01.')
    setErr(null)
    setConfirming(true)
  }

  const createManual = async () => {
    if (!account) return
    setConfirming(false)
    setBusy(true)
    setErr(null)
    try {
      const inv = await createManualInvoice({
        account_id: account.id,
        month_year: month,
        amount: Math.round(fee * 100) / 100,
      })
      setPreview([inv])
    } catch (e) {
      setErr(getApiErrorMessage(e, 'Could not create the invoice.'))
    } finally {
      setBusy(false)
    }
  }

  const markPaid = async (id: string) => {
    setPayingId(id)
    setErr(null)
    try {
      const updated = await updateInvoice(id, { status: 'paid' })
      setPreview((prev) => (prev ? prev.map((i) => (i.id === id ? updated : i)) : prev))
    } catch (e) {
      setErr(getApiErrorMessage(e, 'Could not mark the invoice paid.'))
    } finally {
      setPayingId(null)
    }
  }

  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
  // The trader-side invoice page only opens for the invoice's owner.
  const billingSelf = !!me && me.uni_id === uniId

  return (
    <section
      className="rounded-card border border-border bg-surface p-card"
      data-aos="fade-up"
      data-aos-delay="100"
    >
      <div className="flex items-start gap-3 mb-[18px]">
        <span className={CHIP}>
          <FileText size={16} />
        </span>
        <div className="min-w-0">
          <div className="font-display text-[15px] font-extrabold">Invoice Testing</div>
          <div className="text-[12px] text-muted mt-px">
            {mode === 'pnl'
              ? "Generate an invoice from a user's closed P&L, then settle it manually."
              : 'Bill one account a fee you type — a one-off charge or a real payment test.'}
          </div>
        </div>
        <Link
          to="/admin/invoices"
          className="inline-flex items-center gap-1 ml-auto text-[12px] font-semibold text-accent"
        >
          Invoice History
          <ArrowRight size={13} />
        </Link>
      </div>

      <Tabs tabs={MODES} active={mode} onChange={switchMode} label="Invoice mode" />

      {err && (
        <div className={`${MSG_ERR} mt-3.5`} role="alert">
          <AlertCircle size={15} className="flex-none mt-px" />
          <span>{err}</span>
        </div>
      )}

      <div
        key={mode}
        className="flex flex-wrap items-end gap-3 mt-4 animate-[fadeup_0.35s_ease-out]"
      >
        <label className="flex flex-col gap-1.5 flex-[1_1_200px] min-w-0">
          <span className={FIELD_LABEL}>User</span>
          <select className={SELECT} value={uniId} onChange={(e) => pickUser(e.target.value)}>
            <option value="">Select a user…</option>
            {users.map((u) => (
              <option key={u.uni_id} value={u.uni_id}>
                {u.name || u.email} — {u.email}
              </option>
            ))}
          </select>
        </label>

        {mode === 'manual' && (
          <label className="flex flex-col gap-1.5 flex-[1_1_180px] min-w-0">
            <span className={FIELD_LABEL}>Binance account</span>
            <select
              className={SELECT}
              value={accountId}
              disabled={!uniId || accounts.length === 0}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">
                {!uniId
                  ? 'Pick a user first'
                  : accounts.length === 0
                    ? 'No connected Binance account'
                    : 'Select an account…'}
              </option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · #{a.id}
                  {a.demo ? ' · demo' : ''}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1.5 flex-[1_1_160px] min-w-0">
          <span className={FIELD_LABEL}>Billing month</span>
          <input
            className={INV_INPUT}
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>

        {mode === 'manual' && (
          <label className="flex flex-col gap-1.5 flex-[1_1_130px] min-w-0">
            <span className={FIELD_LABEL}>Fee (USD)</span>
            <input
              className={`${INV_INPUT} font-mono`}
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              placeholder="15.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
        )}

        {mode === 'pnl' ? (
          <button
            type="button"
            className={`${BTN} ${BTN_PRIMARY}`}
            disabled={busy}
            onClick={generate}
          >
            {busy ? (
              'Generating…'
            ) : (
              <>
                <Receipt size={14} /> Generate invoice
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            className={`${BTN} ${BTN_PRIMARY}`}
            disabled={busy}
            onClick={askManual}
          >
            {busy ? (
              'Creating…'
            ) : (
              <>
                <PenLine size={14} /> Create invoice
              </>
            )}
          </button>
        )}
      </div>

      {mode === 'manual' && (
        <p className="text-[11.5px] text-faint mt-2.5 leading-[1.5]">
          Replaces this month's unpaid invoice for the account. Due 7 days from today.
          Paid in crypto, it settles only when the transfer arrives.
        </p>
      )}

      {preview && preview.length > 0 && (
        <div className="mt-[18px] flex flex-col gap-2.5 animate-[fadeup_0.35s_ease-out]">
          {preview.map((inv) => (
            <div
              className="flex items-center flex-wrap gap-x-[18px] gap-y-2.5 py-3.5 px-4 border border-border rounded-[12px] bg-surface2"
              key={inv.id}
            >
              <div className="flex flex-col gap-0.5 min-w-[150px]">
                <span className="font-mono">{inv.formattedId}</span>
                <span className="text-[11.5px] text-muted">
                  {inv.accountName} · {inv.monthLabel}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[12px] text-muted font-mono">
                {inv.feeSource === 'manual' ? (
                  <span>Manual fee</span>
                ) : (
                  <>
                    <span>Realized {fmtMoney(inv.feeRealized)}</span>
                    <span>Unrealized {fmtMoney(inv.feeUnrealized)}</span>
                  </>
                )}
                <span className="text-text font-bold">Total {fmtMoney(inv.totalFee)}</span>
              </div>
              <div className="text-[11.5px] text-faint font-mono">
                HWM {fmtMoney(inv.hwmBefore ?? 0)} → {fmtMoney(inv.hwmAfter ?? 0)}
              </div>
              <div className="ml-auto flex items-center gap-2">
                {billingSelf && inv.status !== 'paid' && inv.totalFee > 0 && (
                  <Link
                    to={`/dashboard/invoices/${inv.id}`}
                    className={`${BTN} ${BTN_SM} border-border text-text hover:border-accent-line`}
                  >
                    Open &amp; pay <ArrowRight size={12} />
                  </Link>
                )}
                {inv.status === 'paid' ? (
                  <span className="inline-flex items-center gap-[5px] text-[12px] font-bold text-green">
                    <CheckCircle2 size={13} /> Paid
                  </span>
                ) : inv.totalFee > 0 ? (
                  <button
                    type="button"
                    className={`${BTN} ${BTN_PRIMARY} ${BTN_SM}`}
                    disabled={payingId === inv.id}
                    onClick={() => markPaid(inv.id)}
                  >
                    {payingId === inv.id ? 'Settling…' : 'Mark paid'}
                  </button>
                ) : (
                  <span className="text-[12px] text-faint">No fee</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={confirming}
        title="Create this invoice?"
        message={
          account
            ? `Bill ${account.name} (#${account.id}) ${fmtMoney(fee)} for ${monthLabel}. ` +
              `It replaces that month's unpaid invoice for this account, if there is one, ` +
              `and is due in 7 days.`
            : ''
        }
        confirmLabel="Create invoice"
        onConfirm={createManual}
        onCancel={() => setConfirming(false)}
      />
    </section>
  )
}
