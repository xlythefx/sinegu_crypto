import { useCallback } from 'react'
import { FileText } from 'lucide-react'
import { useApiData } from '../../../hooks/useApiData'
import { getAdminUserInvoices } from '../../../services/admin'
import { getApiErrorMessage } from '../../../services/api'
import { fmtMediumDate, fmtMoney } from '../../../lib/format'
import type { Invoice } from '../../../lib/billing'
import type { ExchangePillValue } from './ExchangeFilterPill'

const TH =
  'text-left text-[10.5px] uppercase tracking-[0.07em] text-faint font-semibold py-2.5 px-3 border-b border-hair whitespace-nowrap'
const TD = 'py-3 px-3 border-b border-hair align-middle text-[13px]'
const PILL =
  'inline-block text-[10px] font-bold uppercase tracking-[0.05em] py-[3px] px-[9px] rounded-pill whitespace-nowrap'

/** paid / pending are the only statuses — overdue is a flag on pending rows. */
function statusPill(inv: Invoice) {
  if (inv.status === 'paid')
    return {
      label: 'Paid',
      cls: 'bg-[color-mix(in_srgb,var(--green)_16%,transparent)] text-green',
    }
  if (inv.isOverdue && inv.totalFee > 0)
    return {
      label: 'Overdue',
      cls: 'bg-[color-mix(in_srgb,var(--red)_16%,transparent)] text-red',
    }
  return {
    label: 'Outstanding',
    cls: 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-accent',
  }
}

interface UserInvoicesTableProps {
  uniId: string
  /** The page's exchange pill — invoices are per exchange, so it narrows them. */
  exchange?: ExchangePillValue
}

/** The user's invoices — period, fee, status, due & paid dates. Self-fetching. */
export default function UserInvoicesTable({
  uniId,
  exchange = 'all',
}: UserInvoicesTableProps) {
  const fetchInvoices = useCallback(
    () => getAdminUserInvoices(uniId, exchange),
    [uniId, exchange],
  )
  const { data, loading, error } = useApiData(fetchInvoices, [fetchInvoices])
  const invoices = data ?? []

  return (
    <section className="flex flex-col rounded-card border border-border bg-surface p-card">
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="grid h-7 w-7 flex-none place-items-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
          <FileText size={16} />
        </span>
        <div>
          <div className="font-display text-[15px] font-extrabold">Invoices</div>
          <div className="mt-px text-[12px] text-muted">
            {invoices.length} invoice{invoices.length === 1 ? '' : 's'} generated
          </div>
        </div>
      </div>

      {!data ? (
        <div className="grid min-h-[120px] flex-1 place-items-center px-4 text-center text-[13px] text-muted">
          {loading
            ? 'Loading invoices…'
            : getApiErrorMessage(error, 'Could not load invoices.')}
        </div>
      ) : invoices.length === 0 ? (
        <div className="grid min-h-[120px] flex-1 place-items-center rounded-row border border-dashed border-border bg-surface2 px-4 text-center text-[13px] text-muted">
          No invoices yet for this user.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>Period</th>
                <th className={TH}>Total fee</th>
                <th className={TH}>Status</th>
                <th className={TH}>Due date</th>
                <th className={TH}>Paid at</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const pill = statusPill(inv)
                return (
                  <tr key={inv.id} className="transition-colors hover:bg-surface2">
                    <td className={`${TD} font-semibold whitespace-nowrap`}>
                      {inv.monthLabel}
                    </td>
                    <td className={`${TD} font-mono font-bold`}>
                      {fmtMoney(inv.totalFee)}
                    </td>
                    <td className={TD}>
                      <span className={`${PILL} ${pill.cls}`}>{pill.label}</span>
                    </td>
                    <td className={`${TD} font-mono text-[12px] text-muted whitespace-nowrap`}>
                      {inv.dueDate ? fmtMediumDate(inv.dueDate) : '—'}
                    </td>
                    <td className={`${TD} font-mono text-[12px] text-muted whitespace-nowrap`}>
                      {inv.paidDate ? fmtMediumDate(inv.paidDate) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
