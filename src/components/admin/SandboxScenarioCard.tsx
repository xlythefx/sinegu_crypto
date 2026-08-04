import { useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  FlaskConical,
  Play,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import DataState from '../dashboard/DataState'
import { useApiData } from '../../hooks/useApiData'
import {
  clearScenarioAccount,
  clearUserInvoices,
  getInvoiceScenarios,
  runInvoiceScenarios,
} from '../../services/admin'
import { getApiErrorMessage } from '../../services/api'
import { fmtMoney, prevMonth } from '../../lib/format'
import type { AdminUser } from '../../types/admin'
import type {
  InvoiceScenario,
  ScenarioCheck,
  ScenarioResult,
  ScenarioRun,
} from '../../types/admin'

/* ---- token-mapped class strings (mirrors SandboxInvoiceCard / AdminSandbox) ---- */
const CHIP =
  'w-7 h-7 flex-none grid place-items-center rounded-[9px] bg-accent-soft border border-accent-line text-accent'
const MSG =
  'flex items-start gap-2 rounded-[10px] border py-2.5 px-[13px] text-[12.5px] leading-[1.5]'
const MSG_ERR =
  'border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] text-red'
const MSG_OK =
  'border-[color-mix(in_srgb,var(--green)_35%,transparent)] bg-[color-mix(in_srgb,var(--green)_8%,transparent)] text-green'
const MSG_WARN =
  'border-[color-mix(in_srgb,var(--amber,var(--accent))_35%,transparent)] bg-[color-mix(in_srgb,var(--amber,var(--accent))_8%,transparent)] text-muted'
const INPUT =
  'h-10 rounded-[10px] border border-border bg-surface2 text-text px-3 text-[13px] font-body'
const BTN =
  'inline-flex items-center gap-[7px] h-10 rounded-pill border border-transparent px-[18px] text-[13px] font-bold cursor-pointer transition-[filter,border-color,background,opacity] duration-150 disabled:opacity-[0.55] disabled:cursor-not-allowed'
const BTN_PRIMARY = 'bg-accent border-transparent text-on-accent enabled:hover:brightness-[1.06]'
const BTN_GHOST = 'bg-surface2 border-border text-text enabled:hover:border-accent'
const BTN_DANGER =
  'bg-transparent border-[color-mix(in_srgb,var(--red)_40%,transparent)] text-red enabled:hover:bg-[color-mix(in_srgb,var(--red)_10%,transparent)]'
const BTN_SM = 'h-8 px-3 text-[12px]'

type Pending =
  | { kind: 'run'; keys?: string[]; title: string }
  | { kind: 'clear-invoices' }
  | { kind: 'clear-account' }

/** Money for figures, plain integers for counts, raw text for statuses. */
function fmtCheck(field: string, value: number | string): string {
  if (typeof value === 'string') return value
  if (field === 'invoice_count') return String(value)
  return fmtMoney(value)
}

/** One-line description of the world a scenario builds. */
function setupLine(s: InvoiceScenario['setup']): string {
  const bits = [
    `deposit ${fmtMoney(s.initial_deposit)}`,
    `balance ${fmtMoney(s.balance)}`,
    `open P&L ${fmtMoney(s.unrealized)}`,
  ]
  if (s.trades.length) {
    bits.push(`${s.trades.length} trade${s.trades.length === 1 ? '' : 's'} (${s.trades.map((t) => fmtMoney(t)).join(', ')})`)
  } else {
    bits.push('no closed trades')
  }
  if (s.deposits.length) bits.push(`deposits ${s.deposits.map((d) => fmtMoney(d)).join(', ')}`)
  if (s.prior_hwm !== null) bits.push(`prior peak ${fmtMoney(s.prior_hwm)}`)
  return bits.join(' · ')
}

function ResultBadge({ pass }: { pass: boolean }) {
  const tone = pass
    ? 'bg-[color-mix(in_srgb,var(--green)_12%,transparent)] border-[color-mix(in_srgb,var(--green)_35%,transparent)] text-green'
    : 'bg-[color-mix(in_srgb,var(--red)_10%,transparent)] border-[color-mix(in_srgb,var(--red)_35%,transparent)] text-red'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill border py-[3px] px-2.5 text-[11px] font-bold whitespace-nowrap ${tone}`}
    >
      {pass ? <Check size={12} /> : <X size={12} />}
      {pass ? 'Pass' : 'Fail'}
    </span>
  )
}

function CheckRow({ check }: { check: ScenarioCheck }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto_20px] max-[560px]:grid-cols-[1fr_auto_20px] items-center gap-x-3 gap-y-1 py-1.5 border-b border-hair last:border-b-0">
      <span className="text-[12.5px] text-muted">{check.label}</span>
      <span className="font-mono text-[12px] text-faint whitespace-nowrap max-[560px]:hidden">
        want {fmtCheck(check.field, check.expected)}
      </span>
      <span
        className={`font-mono text-[12.5px] font-bold whitespace-nowrap ${check.pass ? 'text-text' : 'text-red'}`}
      >
        {fmtCheck(check.field, check.actual)}
      </span>
      <span className={check.pass ? 'text-green' : 'text-red'}>
        {check.pass ? <Check size={14} /> : <X size={14} />}
      </span>
    </div>
  )
}

/**
 * Automated invoice test cases. Each one resets a throwaway account, seeds real
 * closed trades / transfers / open P&L for the billing month, invoices it
 * through the same service the product uses, then asserts the figures — so the
 * high-water-mark rules stay provably correct as the billing code changes.
 */
export default function SandboxScenarioCard({ users }: { users: AdminUser[] }) {
  const { data: catalogue, loading, error, reload } = useApiData(getInvoiceScenarios)

  const [uniId, setUniId] = useState('')
  const [month, setMonth] = useState(prevMonth())
  const [cleanup, setCleanup] = useState(false)
  const [includePaid, setIncludePaid] = useState(false)

  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [run, setRun] = useState<ScenarioRun | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<Pending | null>(null)

  const selected = users.find((u) => u.uni_id === uniId)

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const ask = (next: Pending) => {
    if (!uniId) {
      setErr('Pick a user first.')
      return
    }
    setErr(null)
    setPending(next)
  }

  const doRun = async (keys?: string[]) => {
    setBusy(keys ? keys[0] : 'all')
    setErr(null)
    setBanner(null)
    try {
      const result = await runInvoiceScenarios({
        uni_id: uniId,
        month_year: month,
        keys,
        cleanup,
      })
      // A single-scenario re-run replaces just that row, keeping the rest.
      setRun((prev) =>
        prev && keys
          ? {
              ...result,
              passed: 0,
              failed: 0,
              results: prev.results.map(
                (r) => result.results.find((n) => n.key === r.key) ?? r,
              ),
            }
          : result,
      )
      if (keys) setOpen((prev) => new Set(prev).add(keys[0]))
    } catch (e) {
      setErr(getApiErrorMessage(e, 'Could not run the scenarios.'))
    } finally {
      setBusy(null)
    }
  }

  const doClearInvoices = async () => {
    setBusy('clear')
    setErr(null)
    setBanner(null)
    try {
      const res = await clearUserInvoices(uniId, { includePaid })
      setBanner(
        `Deleted ${res.deleted} invoice${res.deleted === 1 ? '' : 's'}` +
          (res.skipped_paid ? ` · kept ${res.skipped_paid} already paid` : ''),
      )
    } catch (e) {
      setErr(getApiErrorMessage(e, 'Could not clear the invoices.'))
    } finally {
      setBusy(null)
    }
  }

  const doClearAccount = async () => {
    setBusy('clear')
    setErr(null)
    setBanner(null)
    try {
      const removed = await clearScenarioAccount(uniId)
      setRun(null)
      setBanner(
        removed
          ? 'Scenario account and all of its rows were removed.'
          : 'Nothing to remove — no scenario account exists for this user.',
      )
    } catch (e) {
      setErr(getApiErrorMessage(e, 'Could not remove the scenario account.'))
    } finally {
      setBusy(null)
    }
  }

  const confirm = async () => {
    const job = pending
    setPending(null)
    if (!job) return
    if (job.kind === 'run') await doRun(job.keys)
    else if (job.kind === 'clear-invoices') await doClearInvoices()
    else await doClearAccount()
  }

  if (!catalogue) {
    return (
      <section
        className="rounded-card border border-border bg-surface p-card mt-[18px]"
        data-aos="fade-up"
      >
        <DataState loading={loading} error={error} onRetry={reload} label="scenarios" />
      </section>
    )
  }

  // Merge results over the catalogue so unrun scenarios still list.
  const rows: Array<InvoiceScenario | ScenarioResult> = catalogue.map(
    (s) => run?.results.find((r) => r.key === s.key) ?? s,
  )
  const ran = rows.filter((r): r is ScenarioResult => 'checks' in r)
  const passed = ran.filter((r) => r.pass).length
  const failed = ran.length - passed

  return (
    <section
      className="rounded-card border border-border bg-surface p-card mt-[18px]"
      data-aos="fade-up"
      data-aos-delay="140"
    >
      <div className="flex items-start gap-3 mb-[18px]">
        <span className={CHIP}>
          <FlaskConical size={16} />
        </span>
        <div className="min-w-0">
          <div className="font-display text-[15px] font-extrabold">Invoice Scenarios</div>
          <div className="text-[12px] text-muted mt-px">
            Reset the account, seed real trades, invoice, then check the figures against the
            billing rules.
          </div>
        </div>
      </div>

      <div className={`${MSG} ${MSG_WARN} mb-3.5`}>
        <ShieldAlert size={15} className="flex-none mt-px" />
        <span>
          Runs only ever write to a throwaway sandbox account created under the selected user —
          real exchange accounts, their trade history and their invoices are never touched. The
          scratch account does show on that user's dashboard until you clear it.
        </span>
      </div>

      {err && (
        <div className={`${MSG} ${MSG_ERR} mb-3.5`} role="alert">
          <AlertCircle size={15} className="flex-none mt-px" />
          <span>{err}</span>
        </div>
      )}
      {banner && (
        <div className={`${MSG} ${MSG_OK} mb-3.5`} role="status">
          <Check size={15} className="flex-none mt-px" />
          <span>{banner}</span>
        </div>
      )}

      {/* ---- controls ---- */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 flex-[1_1_200px]">
          <span className="text-[11px] uppercase tracking-[0.06em] text-faint">User</span>
          <select
            className={`${INPUT} cursor-pointer [&>option]:bg-surface [&>option]:text-text`}
            value={uniId}
            onChange={(e) => {
              setUniId(e.target.value)
              setRun(null)
            }}
          >
            <option value="">Select a user…</option>
            {users.map((u) => (
              <option key={u.uni_id} value={u.uni_id}>
                {u.name || u.email} — {u.email}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 flex-[1_1_160px]">
          <span className="text-[11px] uppercase tracking-[0.06em] text-faint">
            Billing month
          </span>
          <input
            className={INPUT}
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <button
          type="button"
          className={`${BTN} ${BTN_PRIMARY}`}
          disabled={busy !== null}
          onClick={() => ask({ kind: 'run', title: 'the full suite' })}
        >
          {busy === 'all' ? (
            'Running…'
          ) : (
            <>
              <Play size={14} /> Run all {catalogue.length} scenarios
            </>
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 mt-3.5">
        <label className="inline-flex items-center gap-2 text-[12.5px] text-muted cursor-pointer">
          <input
            type="checkbox"
            className="accent-[var(--accent)] w-[15px] h-[15px] cursor-pointer"
            checked={cleanup}
            onChange={(e) => setCleanup(e.target.checked)}
          />
          Delete the scratch account when the run finishes
        </label>
        <span className="text-[11.5px] text-faint font-mono">
          Fees fixed at 20% realized / 6% unrealized
        </span>
      </div>

      {/* ---- summary ---- */}
      {ran.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 py-3 px-4 rounded-[12px] border border-border bg-surface2"
          key={`${run?.month_year}-${passed}-${failed}-${ran.length}`}
        >
          <span className="font-display text-[15px] font-extrabold">
            <span className="text-green">{passed} passed</span>
            {failed > 0 && <span className="text-red"> · {failed} failed</span>}
          </span>
          <span className="text-[12px] text-muted">
            billing {run?.month_year} · account{' '}
            <span className="font-mono">{run?.account.name}</span>
            {run?.cleaned_up && ' · scratch data removed'}
          </span>
        </div>
      )}

      {/* ---- scenario list ---- */}
      <div
        className="flex flex-col gap-2.5 mt-4 animate-[fadeup_0.35s_ease-out]"
        key={`${uniId}-${month}-${ran.length}`}
      >
        {rows.map((row) => {
          const result = 'checks' in row ? row : null
          const isOpen = open.has(row.key)

          return (
            <div
              key={row.key}
              className="rounded-[12px] border border-hair bg-surface2 overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 px-4">
                <button
                  type="button"
                  className="flex items-center gap-2.5 min-w-0 flex-[1_1_260px] text-left bg-transparent border-0 p-0 cursor-pointer text-text"
                  onClick={() => toggle(row.key)}
                  aria-expanded={isOpen}
                >
                  <ChevronDown
                    size={15}
                    className={`flex-none text-muted transition-transform duration-150 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                  />
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-bold truncate">{row.title}</span>
                    <span className="block text-[12px] text-muted leading-[1.45]">
                      {row.summary}
                    </span>
                  </span>
                </button>
                <div className="flex items-center gap-2.5 ml-auto">
                  {result && <ResultBadge pass={result.pass} />}
                  <button
                    type="button"
                    className={`${BTN} ${BTN_GHOST} ${BTN_SM}`}
                    disabled={busy !== null}
                    onClick={() => ask({ kind: 'run', keys: [row.key], title: row.title })}
                  >
                    {busy === row.key ? 'Running…' : 'Run'}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-hair animate-[fadeup_0.3s_ease-out]">
                  <div className="text-[11px] uppercase tracking-[0.06em] text-faint mt-3 mb-1.5">
                    Setup
                  </div>
                  <div className="text-[12.5px] text-muted leading-[1.6]">
                    {setupLine(row.setup)}
                  </div>

                  {row.note && (
                    <div className={`${MSG} ${MSG_WARN} mt-3`}>
                      <AlertTriangle size={15} className="flex-none mt-px" />
                      <span>{row.note}</span>
                    </div>
                  )}

                  {result && (
                    <>
                      <div className="text-[11px] uppercase tracking-[0.06em] text-faint mt-4 mb-1.5">
                        What the runner did
                      </div>
                      <ol className="flex flex-col gap-1 m-0 pl-[18px] text-[12.5px] text-muted leading-[1.55]">
                        {result.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>

                      <div className="text-[11px] uppercase tracking-[0.06em] text-faint mt-4 mb-0.5">
                        Checks
                      </div>
                      <div className="flex flex-col">
                        {result.checks.map((check) => (
                          <CheckRow key={check.field} check={check} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ---- cleanup ---- */}
      <div className="flex flex-wrap items-center gap-3 mt-[18px] pt-[18px] border-t border-hair">
        <span className="text-[12px] text-muted flex-[1_1_180px]">
          Cleanup for{' '}
          <span className="font-bold text-text">{selected?.name || selected?.email || 'the selected user'}</span>
        </span>
        <label className="inline-flex items-center gap-2 text-[12.5px] text-muted cursor-pointer">
          <input
            type="checkbox"
            className="accent-[var(--accent)] w-[15px] h-[15px] cursor-pointer"
            checked={includePaid}
            onChange={(e) => setIncludePaid(e.target.checked)}
          />
          Include paid
        </label>
        <button
          type="button"
          className={`${BTN} ${BTN_DANGER} ${BTN_SM}`}
          disabled={busy !== null}
          onClick={() => ask({ kind: 'clear-invoices' })}
        >
          <Trash2 size={13} /> Clear invoices
        </button>
        <button
          type="button"
          className={`${BTN} ${BTN_DANGER} ${BTN_SM}`}
          disabled={busy !== null}
          onClick={() => ask({ kind: 'clear-account' })}
        >
          <Trash2 size={13} /> Clear scenario data
        </button>
      </div>

      <ConfirmModal
        open={pending !== null}
        danger
        title={
          pending?.kind === 'run'
            ? `Run ${pending.title}?`
            : pending?.kind === 'clear-invoices'
              ? 'Delete this user’s invoices?'
              : 'Remove the scenario account?'
        }
        message={
          pending?.kind === 'run'
            ? `A throwaway sandbox account will be created under ${selected?.email ?? 'this user'} and reset between cases. Their real accounts and invoices are not touched.`
            : pending?.kind === 'clear-invoices'
              ? includePaid
                ? `Every invoice belonging to ${selected?.email ?? 'this user'} will be deleted, INCLUDING settled ones. This cannot be undone.`
                : `Unpaid invoices belonging to ${selected?.email ?? 'this user'} will be deleted. Settled invoices are kept. This cannot be undone.`
              : 'The scratch account and all of its seeded trades, transfers and invoices will be permanently removed.'
        }
        confirmLabel={pending?.kind === 'run' ? 'Yes, run it' : 'Yes, delete'}
        cancelLabel="No"
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </section>
  )
}
