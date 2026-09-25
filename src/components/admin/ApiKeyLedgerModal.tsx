import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, History, Loader2, Plus } from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import { ApiError } from '../../services/api'
import { applyAdminApiKeyLedger, getAdminApiKeyLedger } from '../../services/admin'
import { fmtDateTime, fmtMediumDate, fmtMoney, fmtSignedMoney } from '../../lib/format'
import type { AdminApiKey, LedgerPlan } from '../../types/admin'

const BTN_BASE =
  'h-10 px-[18px] rounded-pill text-[13px] font-bold font-body cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed'
const SECTION_LABEL = 'text-[10.5px] font-extrabold tracking-[0.5px] text-faint uppercase'

interface ApiKeyLedgerModalProps {
  /** null = closed. */
  apiKey: AdminApiKey | null
  onClose: () => void
  /** The row as the server returns it after an apply. */
  onApplied: (key: AdminApiKey, message: string) => void
}

/**
 * "Transfer history" for one exchange account: every deposit and withdrawal
 * the exchange still reports (about six months on Binance), which of them we
 * already store, and what the account's starting balance and total deposit
 * become when the rest are added.
 *
 * Opening it is the exchange read — nothing is written until "Apply" is
 * confirmed, and the server re-reads the exchange then and refuses if the
 * history moved since this preview. Portalled into <body> because the page's
 * AOS cards animate with `transform`, which would trap a fixed overlay.
 */
export default function ApiKeyLedgerModal({ apiKey, onClose, onApplied }: ApiKeyLedgerModalProps) {
  const [plan, setPlan] = useState<LedgerPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [applying, setApplying] = useState(false)

  const load = useCallback(async (key: AdminApiKey) => {
    setLoading(true)
    setError(null)
    setPlan(null)
    try {
      setPlan(await getAdminApiKeyLedger(key))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the exchange history.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (apiKey) void load(apiKey)
  }, [apiKey, load])

  useEffect(() => {
    if (!apiKey) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirming && !applying) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [apiKey, confirming, applying, onClose])

  if (!apiKey) return null

  const apply = async () => {
    if (!plan) return
    setApplying(true)
    setError(null)
    try {
      const res = await applyAdminApiKeyLedger(apiKey, plan)
      setConfirming(false)
      onApplied(res.key, res.message)
    } catch (e) {
      setConfirming(false)
      // A 409/422 carries the FRESH plan: show what the exchange says now.
      const fresh =
        e instanceof ApiError ? (e.payload as { plan?: LedgerPlan } | undefined)?.plan : undefined
      if (fresh) setPlan(fresh)
      setError(e instanceof Error ? e.message : 'Could not apply the history.')
    } finally {
      setApplying(false)
    }
  }

  const blocked = !plan || plan.problems.length > 0 || !plan.changes

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[100] grid place-items-center p-4 bg-black/55"
        onClick={() => !applying && onClose()}
        role="dialog"
        aria-modal="true"
        aria-label="Transfer history"
      >
        <div
          className="w-full max-w-[640px] max-h-[90vh] overflow-y-auto bg-surface border border-border rounded-[18px] p-[22px] sm:p-[26px] flex flex-col gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] border border-accent-line bg-accent-soft text-accent">
              <History size={17} />
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-[19px] font-extrabold leading-tight">
                Transfer history
              </h3>
              <p className="text-[12.5px] text-muted mt-1">
                {apiKey.name} · {apiKey.owner.name || apiKey.owner.email || 'Unknown owner'} ·
                read from the exchange's own records
              </p>
            </div>
          </div>

          {loading && (
            <div className="flex items-center gap-2.5 rounded-[12px] border border-hair bg-surface2 p-4 text-[13px] text-muted">
              <Loader2 size={16} className="animate-spin text-accent" />
              Reading every transfer, trade and fee the exchange keeps — this can take
              up to a minute on a busy account.
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="py-2.5 px-3.5 border border-[rgba(239,68,68,0.35)] rounded-field bg-[rgba(239,68,68,0.08)] text-[#ef4444] text-[13px]"
            >
              {error}
            </p>
          )}

          {plan && <PlanBody plan={plan} />}

          <div className="flex flex-wrap justify-end gap-2.5 mt-1">
            <button
              type="button"
              className={`${BTN_BASE} border border-border bg-surface2 text-text`}
              onClick={onClose}
              disabled={applying}
            >
              Close
            </button>
            {!loading && error && !plan && (
              <button
                type="button"
                className={`${BTN_BASE} border border-border bg-surface2 text-text`}
                onClick={() => void load(apiKey)}
              >
                Try again
              </button>
            )}
            {plan && (
              <button
                type="button"
                className={`${BTN_BASE} border-0 bg-accent text-on-accent`}
                disabled={blocked || applying}
                title={
                  plan.problems.length > 0
                    ? 'Resolve the problems above first'
                    : !plan.changes
                      ? 'Already matches the exchange'
                      : undefined
                }
                onClick={() => setConfirming(true)}
              >
                {!plan.changes ? 'Already in sync' : 'Apply…'}
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirming && plan !== null}
        title="Apply the exchange's transfer history?"
        message={
          plan
            ? `This stores ${plan.missing_count} transfer${plan.missing_count === 1 ? '' : 's'} and changes the starting balance from ${
                plan.initial_deposit.before === null ? 'unset' : fmtMoney(plan.initial_deposit.before)
              } to ${fmtMoney(plan.initial_deposit.after)}. Total deposited becomes ${fmtMoney(
                plan.total_deposit.after,
              )} (was ${fmtMoney(plan.total_deposit.before)}). Analytics, the deposit gate and future invoices use these figures${
                plan.invoices > 0 ? `; the ${plan.invoices} invoice(s) already issued keep their own figures` : ''
              }.`
            : ''
        }
        confirmLabel={applying ? 'Applying…' : 'Apply'}
        onConfirm={() => void apply()}
        onCancel={() => !applying && setConfirming(false)}
      />
    </>,
    document.body,
  )
}

function PlanBody({ plan }: { plan: LedgerPlan }) {
  const initialMoves =
    plan.initial_deposit.before === null ||
    Math.abs(plan.initial_deposit.before - plan.initial_deposit.after) >= 0.01
  const totalMoves = Math.abs(plan.total_deposit.before - plan.total_deposit.after) >= 0.01

  return (
    <>
      {plan.problems.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-[12px] border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.06)] p-3.5">
          {plan.problems.map((p) => (
            <p key={p} className="flex items-start gap-2 text-[12.5px] text-text">
              <AlertTriangle size={14} className="mt-0.5 flex-none text-red" />
              {p}
            </p>
          ))}
        </div>
      )}

      {!plan.changes && plan.problems.length === 0 && (
        <p className="flex items-center gap-2 rounded-[12px] border border-[rgba(47,214,122,0.3)] bg-[rgba(47,214,122,0.06)] p-3.5 text-[13px]">
          <CheckCircle2 size={15} className="flex-none text-green" />
          Everything already matches the exchange.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2.5 max-[520px]:grid-cols-1">
        <Figure
          label="Starting balance"
          hint="Held before the first transfer"
          before={plan.initial_deposit.before}
          after={plan.initial_deposit.after}
          moves={initialMoves}
        />
        <Figure
          label="Total deposited"
          hint="Start + deposits − withdrawals"
          before={plan.total_deposit.before}
          after={plan.total_deposit.after}
          moves={totalMoves}
        />
      </div>

      <p className="text-[12px] text-muted leading-[1.55]">
        The exchange's records go back to{' '}
        <strong className="text-text">
          {plan.ledger_start ? fmtMediumDate(plan.ledger_start) : '—'}
        </strong>{' '}
        ({plan.ledger_rows.toLocaleString()} entries) and add up to the current wallet of{' '}
        <strong className="text-text">{fmtMoney(plan.wallet_balance)}</strong>. Anything older is
        what the starting balance still stands for.
        {plan.unclassified_types.length > 0 &&
          ` Also contains ${plan.unclassified_types.join(', ')} — counted in the balance, not as a transfer.`}
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className={SECTION_LABEL}>Transfers ({plan.transfers.length})</span>
          {plan.missing_count > 0 && (
            <span className="text-[11.5px] font-bold text-accent">
              {plan.missing_count} to add
            </span>
          )}
        </div>
        <div className="border border-hair rounded-row overflow-hidden">
          {plan.transfers.length === 0 && (
            <p className="py-3 px-3.5 text-[12px] text-muted">No transfers in the exchange's history.</p>
          )}
          {plan.transfers.map((t) => {
            const deposit = t.type === 'DEPOSIT'
            return (
              <div
                key={t.tran_id}
                className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 px-3.5 border-b border-hair last:border-b-0 ${
                  t.stored ? '' : 'bg-accent-soft'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-bold">{deposit ? 'Deposit' : 'Withdrawal'}</div>
                  <div className="text-[11px] text-muted font-semibold">{fmtDateTime(t.at)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`font-mono text-[13px] font-extrabold ${deposit ? 'text-green' : 'text-red'}`}
                  >
                    {fmtSignedMoney(deposit ? t.amount : -t.amount)}
                  </span>
                  {t.stored ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted">
                      <CheckCircle2 size={12} /> Stored
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-accent">
                      <Plus size={12} /> Will add
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {plan.unknown_stored.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className={SECTION_LABEL}>Stored here, unknown to the exchange</span>
          <div className="border border-[rgba(239,68,68,0.35)] rounded-row overflow-hidden">
            {plan.unknown_stored.map((t) => (
              <div
                key={t.tran_id}
                className="flex items-center justify-between gap-3 py-2.5 px-3.5 border-b border-hair last:border-b-0 text-[12.5px]"
              >
                <span>
                  {t.type} · {fmtDateTime(t.at)} · id {t.tran_id}
                </span>
                <span className="font-mono font-bold">{fmtMoney(t.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {plan.invoices > 0 && (
        <p className="flex items-start gap-2 text-[12px] text-muted">
          <AlertTriangle size={13} className="mt-0.5 flex-none text-accent" />
          This account has {plan.invoices} invoice(s). Issued invoices keep their own figures;
          only future ones use the corrected deposit.
        </p>
      )}
    </>
  )
}

function Figure({
  label,
  hint,
  before,
  after,
  moves,
}: {
  label: string
  hint: string
  before: number | null
  after: number
  moves: boolean
}) {
  return (
    <div className="rounded-[12px] border border-hair bg-surface2 p-3.5">
      <div className={SECTION_LABEL}>{label}</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[15px] font-extrabold">
        {moves ? (
          <>
            <span className="text-muted line-through decoration-1">
              {before === null ? 'unset' : fmtMoney(before)}
            </span>
            <ArrowRight size={14} className="text-faint" />
            <span className="text-accent">{fmtMoney(after)}</span>
          </>
        ) : (
          <span>{fmtMoney(after)}</span>
        )}
      </div>
      <div className="mt-1 text-[11px] text-muted">{hint}</div>
    </div>
  )
}
