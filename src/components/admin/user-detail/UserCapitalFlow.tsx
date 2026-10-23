import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Landmark,
} from 'lucide-react'
import MetricTile from '../../analytics/MetricTile'
import { EXCHANGE_META } from '../../exchanges/meta'
import { fmtDateTimeYear, fmtMoney, fmtSignedMoney } from '../../../lib/format'
import type { AdminUserSummary, CapitalTransfer } from '../../../types/admin'

interface UserCapitalFlowProps {
  summary: AdminUserSummary | null
  loading: boolean
}

/** Deposits / withdrawals / net flow / capital — 4 tiles, then every transfer. */
export default function UserCapitalFlow({
  summary,
  loading,
}: UserCapitalFlowProps) {
  const cf = summary?.capital_flow

  return (
    <section className="flex flex-col rounded-card border border-border bg-surface p-card">
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="grid h-7 w-7 flex-none place-items-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
          <ArrowLeftRight size={16} />
        </span>
        <div>
          <div className="font-display text-[15px] font-extrabold">
            Capital Flow
          </div>
          <div className="mt-px text-[12px] text-muted">
            Deposits and withdrawals across live accounts
          </div>
        </div>
      </div>

      {!cf ? (
        <div className="grid min-h-[140px] flex-1 place-items-center text-[13px] text-muted">
          {loading ? 'Loading capital flow…' : 'Could not load capital flow.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          <MetricTile
            label="Total Deposits"
            value={fmtMoney(cf.deposits)}
            tone="pos"
            icon={ArrowDownToLine}
            iconTone="pos"
            sub={`${cf.deposit_count} transaction${cf.deposit_count === 1 ? '' : 's'}`}
          />
          <MetricTile
            label="Total Withdrawals"
            value={fmtMoney(cf.withdrawals)}
            tone="neg"
            icon={ArrowUpFromLine}
            iconTone="neg"
            sub={`${cf.withdrawal_count} transaction${cf.withdrawal_count === 1 ? '' : 's'}`}
          />
          <MetricTile
            label="Net Flow"
            value={fmtSignedMoney(cf.net_flow)}
            tone={cf.net_flow < 0 ? 'neg' : 'pos'}
            icon={ArrowLeftRight}
            sub="Deposits − withdrawals"
          />
          <MetricTile
            label="Capital"
            value={fmtMoney(cf.capital)}
            icon={Landmark}
            sub="Initial deposit + net flow"
          />
        </div>
      )}

      {cf && (
        <TransferList
          key={summary?.exchange ?? 'all'}
          transfers={cf.transfers ?? []}
        />
      )}
    </section>
  )
}

/** Every deposit and withdrawal, newest first, dated when the money moved. */
function TransferList({ transfers }: { transfers: CapitalTransfer[] }) {
  // The venue only tells rows apart when more than one is in the list.
  const showVenue = new Set(transfers.map((t) => t.exchange)).size > 1

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col animate-[fadeup_0.35s_ease-out]">
      <div className="mb-2 flex items-baseline justify-between gap-3 px-0.5">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">
          Transfers
        </span>
        {transfers.length > 0 && (
          <span className="text-[11.5px] text-muted">
            {transfers.length} total · newest first
          </span>
        )}
      </div>

      {transfers.length === 0 ? (
        <div className="grid min-h-[90px] place-items-center rounded-[12px] border border-dashed border-border px-4 text-center text-[12.5px] text-muted">
          No deposits or withdrawals recorded yet.
        </div>
      ) : (
        <ul className="max-h-[320px] overflow-y-auto rounded-[12px] border border-border">
          {transfers.map((t) => {
            const deposit = t.type === 'deposit'
            const Icon = deposit ? ArrowDownToLine : ArrowUpFromLine
            return (
              <li
                key={`${t.exchange}-${t.id}`}
                className="flex items-center gap-3 border-b border-border px-3.5 py-2.5 last:border-b-0"
              >
                <span
                  className={`grid h-7 w-7 flex-none place-items-center rounded-full ${
                    deposit ? 'bg-green/10 text-green' : 'bg-red/10 text-red'
                  }`}
                >
                  <Icon size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[13px] font-semibold">
                    {deposit ? 'Deposit' : 'Withdrawal'}
                    {showVenue && (
                      <span className="rounded-full border border-border px-1.5 py-px text-[10.5px] font-medium text-muted">
                        {EXCHANGE_META[t.exchange]?.label ?? t.exchange}
                      </span>
                    )}
                  </div>
                  <div className="mt-px text-[11.5px] text-muted">
                    {fmtDateTimeYear(t.at)}
                  </div>
                </div>
                <span
                  className={`flex-none font-mono text-[13px] font-semibold ${
                    deposit ? 'text-green' : 'text-red'
                  }`}
                >
                  {deposit ? '+' : '−'}
                  {fmtMoney(t.amount)}
                  {t.currency !== 'USDT' && (
                    <span className="ml-1 text-[10.5px] text-muted">{t.currency}</span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
