import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowRight, CheckCircle2, FileText, Receipt } from 'lucide-react'
import { generateInvoices, updateInvoice } from '../../services/admin'
import { getApiErrorMessage } from '../../services/api'
import { fmtMoney } from '../../lib/format'
import type { Invoice } from '../../lib/billing'
import type { AdminUser } from '../../types/admin'

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
    <section className="dcard asbx-inv" data-aos="fade-up" data-aos-delay="100">
      <div className="asbx-card__head">
        <span className="dchip">
          <FileText size={16} />
        </span>
        <div className="asbx-card__head-text">
          <div className="dcard__title">Invoice Testing</div>
          <div className="dcard__sub">
            Generate an invoice from a user's closed P&L, then settle it manually.
          </div>
        </div>
        <Link to="/admin/invoices" className="asbx-inv__link">
          Invoice History
          <ArrowRight size={13} />
        </Link>
      </div>

      {err && (
        <div className="asbx-msg asbx-msg--err asbx-inv__err" role="alert">
          <AlertCircle size={15} />
          <span>{err}</span>
        </div>
      )}

      <div className="asbx-inv__form">
        <label className="asbx-inv__field">
          <span>User</span>
          <select value={uniId} onChange={(e) => setUniId(e.target.value)}>
            <option value="">Select a user…</option>
            {users.map((u) => (
              <option key={u.uni_id} value={u.uni_id}>
                {u.name || u.email} — {u.email}
              </option>
            ))}
          </select>
        </label>
        <label className="asbx-inv__field">
          <span>Billing month</span>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
        <button
          type="button"
          className="asbx-btn asbx-btn--primary"
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
        <div className="asbx-inv__preview">
          {preview.map((inv) => (
            <div className="asbx-inv__row" key={inv.id}>
              <div className="asbx-inv__row-id">
                <span className="mono">{inv.formattedId}</span>
                <span className="asbx-inv__row-acct">
                  {inv.accountName} · {inv.monthLabel}
                </span>
              </div>
              <div className="asbx-inv__row-nums mono">
                <span>Realized {fmtMoney(inv.feeRealized)}</span>
                <span>Unrealized {fmtMoney(inv.feeUnrealized)}</span>
                <span className="asbx-inv__row-total">Total {fmtMoney(inv.totalFee)}</span>
              </div>
              <div className="asbx-inv__row-hwm mono">
                HWM {fmtMoney(inv.hwmBefore ?? 0)} → {fmtMoney(inv.hwmAfter ?? 0)}
              </div>
              <div className="asbx-inv__row-action">
                {inv.status === 'paid' ? (
                  <span className="asbx-inv__paid">
                    <CheckCircle2 size={13} /> Paid
                  </span>
                ) : inv.totalFee > 0 ? (
                  <button
                    type="button"
                    className="asbx-btn asbx-btn--primary asbx-btn--sm"
                    disabled={payingId === inv.id}
                    onClick={() => markPaid(inv.id)}
                  >
                    {payingId === inv.id ? 'Settling…' : 'Mark paid'}
                  </button>
                ) : (
                  <span className="asbx-inv__nofee">No fee</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
