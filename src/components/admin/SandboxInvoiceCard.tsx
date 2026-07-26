import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowRight, CheckCircle2, FileText, Receipt } from 'lucide-react'
import { generateInvoices, updateInvoice } from '../../services/admin'
import { getApiErrorMessage } from '../../services/api'
import { fmtMoney } from '../../lib/format'
import type { Invoice } from '../../lib/billing'
import type { AdminUser } from '../../types/admin'

/* ---- token-mapped class strings (mirrors AdminSandbox / billing/InvoiceCard) ---- */
const CHIP =
  'w-7 h-7 flex-none grid place-items-center rounded-[9px] bg-accent-soft border border-accent-line text-accent'
const MSG_ERR =
  'flex items-start gap-2 rounded-[10px] border py-2.5 px-[13px] text-[12.5px] leading-[1.5] border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] text-red'
const INV_INPUT =
  'h-10 rounded-[10px] border border-border bg-surface2 text-text px-3 text-[13px] font-body'
const BTN =
  'inline-flex items-center gap-[7px] h-10 rounded-pill border border-transparent px-[18px] text-[13px] font-bold cursor-pointer transition-[filter,border-color,background,opacity] duration-150 disabled:opacity-[0.55] disabled:cursor-not-allowed'
const BTN_PRIMARY = 'bg-accent border-transparent text-on-accent enabled:hover:brightness-[1.06]'
const BTN_SM = 'h-8 px-3 text-[12px]'

/** Previous calendar month as YYYY-MM (the period invoices bill for). */
function prevMonth(): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Manual invoice workflow for the admin sandbox: pick a user + month, generate
 * an invoice from their closed P&L, preview the fees/HWM, and settle it by hand.
 * This is the "charge manually first" surface before live payment providers.
 */
export default function SandboxInvoiceCard({ users }: { users: AdminUser[] }) {
  const [uniId, setUniId] = useState('')
  const [month, setMonth] = useState(prevMonth())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [preview, setPreview] = useState<Invoice[] | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)

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
            Generate an invoice from a user's closed P&L, then settle it manually.
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

      {err && (
        <div className={`${MSG_ERR} mt-3.5`} role="alert">
          <AlertCircle size={15} className="flex-none mt-px" />
          <span>{err}</span>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 mt-4">
        <label className="flex flex-col gap-1.5 flex-[1_1_200px]">
          <span className="text-[11px] uppercase tracking-[0.06em] text-faint">User</span>
          <select
            className={`${INV_INPUT} cursor-pointer [&>option]:bg-surface [&>option]:text-text`}
            value={uniId}
            onChange={(e) => setUniId(e.target.value)}
          >
            <option value="">Select a user…</option>
            {users.map((u) => (
              <option key={u.uni_id} value={u.uni_id}>
                {u.name || u.email} — {u.email}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 flex-[1_1_200px]">
          <span className="text-[11px] uppercase tracking-[0.06em] text-faint">
            Billing month
          </span>
          <input
            className={INV_INPUT}
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
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
      </div>

      {preview && preview.length > 0 && (
        <div className="mt-[18px] flex flex-col gap-2.5">
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
                <span>Realized {fmtMoney(inv.feeRealized)}</span>
                <span>Unrealized {fmtMoney(inv.feeUnrealized)}</span>
                <span className="text-text font-bold">Total {fmtMoney(inv.totalFee)}</span>
              </div>
              <div className="text-[11.5px] text-faint font-mono">
                HWM {fmtMoney(inv.hwmBefore ?? 0)} → {fmtMoney(inv.hwmAfter ?? 0)}
              </div>
              <div className="ml-auto">
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
    </section>
  )
}
