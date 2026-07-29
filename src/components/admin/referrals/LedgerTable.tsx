import { useState } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
} from 'lucide-react'
import DataState from '../../dashboard/DataState'
import { useApiData } from '../../../hooks/useApiData'
import { fetchProofBlob, getAffiliateLedger } from '../../../services/adminReferrals'
import { getApiErrorMessage } from '../../../services/api'
import { formatMonth, tronscanTxUrl, truncateAddress } from '../../../lib/referrals'
import { fmtDateTime, fmtMoney } from '../../../lib/format'
import type { AdminLedgerPayout } from '../../../types/referrals'

const PER_PAGE = 10

const TH =
  'text-left text-[10.5px] uppercase tracking-[0.07em] text-faint font-semibold py-0 px-3.5 pb-2.5 border-b border-border whitespace-nowrap'
const TD = 'py-3.5 px-3.5 border-b border-hair text-[13px] text-text align-middle'
const PAG_BTN =
  'grid place-items-center w-8 h-8 border border-border bg-surface2 text-text rounded-[9px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
const ICON_BTN =
  'inline-grid place-items-center w-7 h-7 rounded-[8px] border border-border bg-surface2 text-muted cursor-pointer transition-[border-color,color] duration-150 hover:text-text hover:border-accent'

/** "Ledger" tab — every payout envelope ever sent, newest first. */
export default function LedgerTable() {
  const { data, loading, error, reload } = useApiData(getAffiliateLedger)

  const [page, setPage] = useState(1)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [proofLoadingId, setProofLoadingId] = useState<number | null>(null)
  const [proofError, setProofError] = useState<string | null>(null)

  if (!data) {
    return <DataState loading={loading} error={error} onRetry={reload} label="ledger" />
  }

  const payouts = data
  const totalPages = Math.max(1, Math.ceil(payouts.length / PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paginated = payouts.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)

  const copyAddress = (p: AdminLedgerPayout) => {
    navigator.clipboard.writeText(p.payoutAddress)
    setCopiedId(p.id)
    window.setTimeout(() => {
      setCopiedId((current) => (current === p.id ? null : current))
    }, 1600)
  }

  const openProof = async (p: AdminLedgerPayout) => {
    setProofLoadingId(p.id)
    setProofError(null)
    try {
      const blob = await fetchProofBlob(p.id)
      window.open(URL.createObjectURL(blob))
    } catch (err) {
      setProofError(getApiErrorMessage(err, 'Unable to load the proof file.'))
    } finally {
      setProofLoadingId(null)
    }
  }

  return (
    <section
      className="rounded-card border border-border bg-surface p-[18px]"
      data-aos="fade-up"
    >
      <div className="mb-4">
        <h2 className="font-display text-[16px] font-bold text-text">Ledger</h2>
        <p className="text-[12px] text-muted mt-0.5">All fees sent, latest at top.</p>
      </div>

      {proofError && (
        <p className="text-red text-[12.5px] mb-2.5" role="alert">
          {proofError}
        </p>
      )}

      {payouts.length === 0 ? (
        <p className="text-[13px] text-muted text-center py-8">
          No payouts released yet.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[820px]">
              <thead>
                <tr>
                  <th className={TH}>Paid at</th>
                  <th className={TH}>Referrer</th>
                  <th className={TH}>Month</th>
                  <th className={`${TH} text-right`}>Amount</th>
                  <th className={TH}>Payout address</th>
                  <th className={TH}>TX hash</th>
                  <th className={TH}>Proof</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((p) => (
                  <tr key={p.id}>
                    <td className={`${TD} text-muted whitespace-nowrap`}>
                      {p.paidAt ? fmtDateTime(p.paidAt) : '—'}
                    </td>
                    <td className={TD}>
                      <span className="block font-semibold">{p.referrerName}</span>
                      <span className="block text-[11px] text-faint break-all">
                        {p.referrerEmail ?? ''}
                      </span>
                    </td>
                    <td className={`${TD} text-muted whitespace-nowrap`}>
                      {formatMonth(p.monthYear)}
                    </td>
                    <td className={`${TD} text-right font-mono font-bold`}>
                      {fmtMoney(p.totalAmount)}
                    </td>
                    <td className={TD}>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-mono text-[12px] text-muted">
                          {truncateAddress(p.payoutAddress)}
                        </span>
                        <button
                          type="button"
                          className={ICON_BTN}
                          onClick={() => copyAddress(p)}
                          title="Copy address"
                          aria-label="Copy payout address"
                        >
                          {copiedId === p.id ? (
                            <Check size={12} className="text-green" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </span>
                    </td>
                    <td className={TD}>
                      {p.txHash ? (
                        <a
                          href={tronscanTxUrl(p.txHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-[12px] text-accent hover:underline"
                        >
                          {truncateAddress(p.txHash)}
                          <ExternalLink size={11} />
                        </a>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className={TD}>
                      {p.hasProof ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-[5px] rounded-[9px] py-1.5 px-2.5 text-[12px] font-semibold cursor-pointer border border-border bg-surface2 text-muted transition-[border-color,color] duration-150 hover:text-text hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={() => openProof(p)}
                          disabled={proofLoadingId === p.id}
                        >
                          <FileText size={12} />
                          {proofLoadingId === p.id ? 'Opening…' : 'View'}
                        </button>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2.5 mt-4 pt-3.5 border-t border-hair">
            <span className="text-[12px] text-faint">
              Page {safePage} of {totalPages} ({(safePage - 1) * PER_PAGE + 1}–
              {Math.min(safePage * PER_PAGE, payouts.length)} of {payouts.length})
            </span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                className={PAG_BTN}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                type="button"
                className={PAG_BTN}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                aria-label="Next page"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
