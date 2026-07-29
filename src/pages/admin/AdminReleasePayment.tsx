import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  FileText,
  Landmark,
  Send,
  Upload,
  Wallet,
} from 'lucide-react'
import AdminLayout from '../../components/admin/AdminLayout'
import DataState from '../../components/dashboard/DataState'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { EXCHANGE_META } from '../../components/exchanges/meta'
import { useApiData } from '../../hooks/useApiData'
import {
  getReferrerReleasable,
  releaseBankWire,
  releaseCrypto,
} from '../../services/adminReferrals'
import { ApiError, getApiErrorMessage } from '../../services/api'
import { formatMonth, lineKey, truncateAddress } from '../../lib/referrals'
import { fmtMoney } from '../../lib/format'
import type {
  BankWireAccount,
  CryptoWallet,
  PaymentMethod,
  ReleasableLine,
  ReleaseTriple,
} from '../../types/referrals'

const ACCEPTED_PROOF_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]
const MAX_PROOF_BYTES = 5 * 1024 * 1024

const CHECKBOX = 'w-[15px] h-[15px] flex-none accent-[var(--accent)] cursor-pointer'
const CHIP_BASE =
  'border rounded-pill py-[7px] px-3.5 text-[12px] font-semibold cursor-pointer transition-[border-color,color] duration-150'
const STEP_NUM =
  'w-7 h-7 flex-none grid place-items-center rounded-full bg-accent-soft text-accent font-mono text-[12.5px] font-bold'
const LABEL = 'font-mono text-[10px] font-semibold tracking-[0.12em] text-faint'
const PREFERRED_PILL =
  'inline-block text-[9.5px] font-bold uppercase tracking-[0.05em] py-[2px] px-2 rounded-pill bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-accent'
const WARN_BOX =
  'rounded-row border border-[color-mix(in_srgb,var(--red)_30%,transparent)] bg-[color-mix(in_srgb,var(--red)_6%,transparent)] p-3.5 flex items-start gap-2.5 text-[12.5px] text-red'

interface Receipt {
  amount: number
  lines: number
  method: PaymentMethod
  address: string
  txHash: string | null
  proofName: string | null
}

interface SubmitError {
  message: string
  status: number
}

interface LineGroup {
  uniId: string
  name: string
  lines: ReleasableLine[]
}

/**
 * Full-screen release flow — select releasable lines (triple-keyed), pick the
 * payout method, confirm, and submit. The server owns all commission math and
 * re-validates every line inside a transaction.
 */
export default function AdminReleasePayment() {
  const { referrerUniId = '' } = useParams()
  const navigate = useNavigate()

  const { data, loading, error, reload } = useApiData(
    () => getReferrerReleasable(referrerUniId),
    [referrerUniId],
  )

  // step 1 — selection (identity is ALWAYS the triple key, never an invoice id)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // step 2 — payment method
  const [method, setMethod] = useState<PaymentMethod>('crypto')
  const [walletId, setWalletId] = useState<number | null>(null)
  const [bankId, setBankId] = useState<number | null>(null)
  const [txHash, setTxHash] = useState('')
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofPreview, setProofPreview] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [copiedWalletId, setCopiedWalletId] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // submit
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<SubmitError | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)

  // Pre-select every line + the preferred (main) payout method on load/reload.
  useEffect(() => {
    if (!data) return
    setSelected(new Set(data.items.map(lineKey)))
    const defaultWallet = data.wallets.find((w) => w.isMain) ?? data.wallets[0] ?? null
    const defaultBank =
      data.bankAccounts.find((b) => b.isMain) ?? data.bankAccounts[0] ?? null
    setWalletId(defaultWallet?.id ?? null)
    setBankId(defaultBank?.id ?? null)
    if (data.bankAccounts.some((b) => b.isMain) && !data.wallets.some((w) => w.isMain)) {
      setMethod('bank_wire')
    } else {
      setMethod('crypto')
    }
  }, [data])

  // Revoke the previous preview object URL when replaced / on unmount.
  useEffect(() => {
    return () => {
      if (proofPreview) URL.revokeObjectURL(proofPreview)
    }
  }, [proofPreview])

  const groups = useMemo<LineGroup[]>(() => {
    if (!data) return []
    const map = new Map<string, LineGroup>()
    for (const line of data.items) {
      const existing = map.get(line.referredUserUniId)
      if (existing) existing.lines.push(line)
      else
        map.set(line.referredUserUniId, {
          uniId: line.referredUserUniId,
          name: line.referredName,
          lines: [line],
        })
    }
    return [...map.values()]
  }, [data])

  const items = useMemo(() => data?.items ?? [], [data])
  const selectedLines = useMemo(
    () => items.filter((l) => selected.has(lineKey(l))),
    [items, selected],
  )
  // Display-only sum of server-computed figures — never fee × pct.
  const total = selectedLines.reduce((sum, l) => sum + l.commission, 0)
  const allSelected = items.length > 0 && selectedLines.length === items.length

  const selectedWallet: CryptoWallet | null =
    data?.wallets.find((w) => w.id === walletId) ?? null
  const selectedBank: BankWireAccount | null =
    data?.bankAccounts.find((b) => b.id === bankId) ?? null

  const methodReady =
    method === 'crypto'
      ? selectedWallet !== null && txHash.trim() !== ''
      : selectedBank !== null && proofFile !== null
  const canSubmit = selectedLines.length > 0 && methodReady

  if (error instanceof ApiError && error.status === 401) {
    return <Navigate to="/auth" replace />
  }

  const pct = data?.affiliatePercentage ?? 0
  const subtitle = data ? `${data.referrerName} · ${pct}% rate` : undefined

  const toggleLine = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const toggleGroup = (group: LineGroup) => {
    const keys = group.lines.map(lineKey)
    const allInGroup = keys.every((k) => selected.has(k))
    setSelected((prev) => {
      const next = new Set(prev)
      if (allInGroup) keys.forEach((k) => next.delete(k))
      else keys.forEach((k) => next.add(k))
      return next
    })
  }

  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(items.map(lineKey)))
  }

  const toggleCollapse = (uniId: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(uniId)) next.delete(uniId)
      else next.add(uniId)
      return next
    })

  const copyWalletAddress = (w: CryptoWallet) => {
    navigator.clipboard.writeText(w.address)
    setCopiedWalletId(w.id)
    window.setTimeout(() => {
      setCopiedWalletId((current) => (current === w.id ? null : current))
    }, 1600)
  }

  const handleFile = (file: File) => {
    setFileError(null)
    if (!ACCEPTED_PROOF_TYPES.includes(file.type)) {
      setFileError('Only JPEG, PNG, GIF, WebP, or PDF files are allowed.')
      return
    }
    if (file.size > MAX_PROOF_BYTES) {
      setFileError('File is too large — the maximum is 5 MB.')
      return
    }
    setProofFile(file)
    setProofPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
  }

  const runRelease = async () => {
    if (!data || !canSubmit || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    const triples: ReleaseTriple[] = selectedLines.map((l) => ({
      referred_user_uni_id: l.referredUserUniId,
      exchange: l.exchange,
      month_year: l.monthYear,
    }))
    try {
      let address: string
      if (method === 'crypto') {
        address = selectedWallet!.address
        await releaseCrypto({
          referrerUniId,
          items: triples,
          payoutAddress: address,
          txHash: txHash.trim(),
        })
      } else {
        address =
          selectedBank!.label ||
          selectedBank!.iban ||
          selectedBank!.accountNumber ||
          'Bank account'
        await releaseBankWire({
          referrerUniId,
          items: triples,
          payoutAddress: address,
          proofFile: proofFile!,
        })
      }
      setConfirmOpen(false)
      setReceipt({
        amount: total,
        lines: selectedLines.length,
        method,
        address,
        txHash: method === 'crypto' ? txHash.trim() : null,
        proofName: method === 'bank_wire' ? proofFile!.name : null,
      })
    } catch (err) {
      setConfirmOpen(false)
      setSubmitError({
        message: getApiErrorMessage(err, 'The release could not be completed.'),
        status: err instanceof ApiError ? err.status : 0,
      })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success receipt ───────────────────────────────────────────────────────
  if (receipt) {
    const receiptRows: [string, string][] = [
      ['Referrer', data?.referrerName ?? '—'],
      ['Lines', `${receipt.lines} line${receipt.lines === 1 ? '' : 's'}`],
      ['Amount Sent', fmtMoney(receipt.amount)],
      ['Method', receipt.method === 'crypto' ? 'Crypto (USDT)' : 'Bank wire'],
      receipt.method === 'crypto'
        ? ['TX Hash', receipt.txHash ?? '—']
        : ['Proof', receipt.proofName ?? '—'],
      ['Address', receipt.address],
    ]
    return (
      <AdminLayout title="Release Commission" subtitle={subtitle}>
        <section
          className="max-w-[560px] mx-auto rounded-card border border-border bg-surface p-card text-center"
          data-aos="fade-up"
        >
          <span className="mx-auto mb-4 w-14 h-14 grid place-items-center rounded-full bg-[color-mix(in_srgb,var(--green)_14%,transparent)] text-green">
            <Check size={26} strokeWidth={2.5} />
          </span>
          <h2 className="font-display text-[22px] font-extrabold tracking-[-0.02em] text-text mb-1">
            Payment released
          </h2>
          <p className="text-[13px] text-muted mb-5">
            The commission payout was recorded in the ledger.
          </p>
          <dl className="text-left border-t border-hair mb-6">
            {receiptRows.map(([label, value]) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-4 py-2.5 border-b border-hair"
              >
                <dt className="text-[12px] text-faint uppercase tracking-[0.05em] flex-none">
                  {label}
                </dt>
                <dd className="text-[13px] text-text font-semibold font-mono text-right [overflow-wrap:anywhere]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-pill bg-accent text-on-accent font-bold text-[13.5px] py-2.5 px-5 shadow-[0_10px_24px_var(--glow)] cursor-pointer transition-[filter] duration-150 hover:brightness-[1.06]"
            onClick={() => navigate('/admin/referrals')}
          >
            <ArrowLeft size={14} />
            Back to Affiliate Dashboard
          </button>
        </section>
      </AdminLayout>
    )
  }

  // ── Loading / error ───────────────────────────────────────────────────────
  if (!data) {
    return (
      <AdminLayout title="Release Commission" subtitle={subtitle}>
        <DataState
          loading={loading}
          error={error}
          onRetry={reload}
          label="releasable lines"
        />
      </AdminLayout>
    )
  }

  // ── Nothing to release ────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <AdminLayout title="Release Commission" subtitle={subtitle}>
        <section
          className="max-w-[560px] mx-auto rounded-card border border-dashed border-border bg-surface p-card flex flex-col items-center text-center py-12 px-6"
          data-aos="fade-up"
        >
          <CheckCircle2 size={42} className="text-green mb-3.5" />
          <h2 className="text-[17px] font-bold text-text mb-1.5">Nothing to release</h2>
          <p className="text-[13px] text-muted max-w-[380px] mb-5">
            Every paid invoice line for {data.referrerName} has already been released.
          </p>
          <Link
            to="/admin/referrals"
            className="inline-flex items-center gap-1.5 border border-border bg-surface2 text-text py-2 px-4 rounded-pill text-[12.5px] font-semibold hover:border-accent"
          >
            <ArrowLeft size={13} />
            Back to Affiliate
          </Link>
        </section>
      </AdminLayout>
    )
  }

  const confirmMessage =
    method === 'crypto' && selectedWallet
      ? `Send ${fmtMoney(total)} to ${data.referrerName} for ${selectedLines.length} line${
          selectedLines.length === 1 ? '' : 's'
        } via crypto — wallet ${truncateAddress(selectedWallet.address)}, TX hash ${truncateAddress(
          txHash.trim(),
        )}.`
      : selectedBank && proofFile
        ? `Send ${fmtMoney(total)} to ${data.referrerName} for ${selectedLines.length} line${
            selectedLines.length === 1 ? '' : 's'
          } via bank wire — account "${selectedBank.label}", proof file ${proofFile.name}.`
        : ''

  return (
    <AdminLayout title="Release Commission" subtitle={subtitle}>
      <div className="max-w-[880px] mx-auto">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 border border-border bg-surface2 text-muted rounded-pill py-2 px-3.5 text-[12.5px] font-semibold cursor-pointer transition-[border-color,color] duration-150 hover:text-text hover:border-accent mb-[18px]"
          onClick={() => navigate('/admin/referrals')}
        >
          <ArrowLeft size={14} />
          Back to Affiliate
        </button>

        {submitError && (
          <div className={`${WARN_BOX} mb-[14px]`} role="alert">
            <AlertCircle size={15} className="flex-none mt-px" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold [overflow-wrap:anywhere]">{submitError.message}</p>
              {submitError.status === 422 && (
                <button
                  type="button"
                  className="mt-2.5 inline-flex items-center gap-1.5 border border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-transparent text-red rounded-pill py-1.5 px-3.5 text-[12px] font-semibold cursor-pointer hover:bg-[color-mix(in_srgb,var(--red)_10%,transparent)]"
                  onClick={() => {
                    setSubmitError(null)
                    reload()
                  }}
                >
                  Reload lines
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Step 1 — select lines ─────────────────────────────────────── */}
        <section
          className="rounded-card border border-border bg-surface p-card mb-[18px]"
          data-aos="fade-up"
        >
          <div className="flex items-center gap-2.5 mb-4">
            <span className={STEP_NUM}>1</span>
            <div>
              <h2 className="font-display text-[16px] font-bold text-text">
                Select lines to release
              </h2>
              <p className="text-[12px] text-muted mt-0.5">
                Each line is one exchange × month of paid fees for a referred user.
              </p>
            </div>
          </div>

          <div className="rounded-row border border-border bg-surface2 p-3.5 flex items-center justify-between flex-wrap gap-3 mb-3.5">
            <div>
              <p className="text-[10.5px] uppercase tracking-[0.07em] text-faint mb-[3px]">
                Total to release
              </p>
              <p className="text-[22px] font-bold font-mono tabular-nums text-text leading-[1.1]">
                {fmtMoney(total)}
              </p>
              <p className="text-[11px] text-faint mt-[3px]">
                {selectedLines.length} of {items.length} line
                {items.length === 1 ? '' : 's'} selected
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                className={CHECKBOX}
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = selectedLines.length > 0 && !allSelected
                }}
                onChange={toggleAll}
              />
              Select all releasable
            </label>
          </div>

          <div className="flex flex-col gap-3">
            {groups.map((group) => {
              const keys = group.lines.map(lineKey)
              const selCount = keys.filter((k) => selected.has(k)).length
              const allInGroup = selCount === keys.length
              const someInGroup = selCount > 0 && !allInGroup
              const isCollapsed = collapsedGroups.has(group.uniId)
              const subtotal = group.lines
                .filter((l) => selected.has(lineKey(l)))
                .reduce((sum, l) => sum + l.commission, 0)

              return (
                <div
                  key={group.uniId}
                  className="rounded-row border border-border bg-surface2 overflow-hidden"
                >
                  <div className="flex items-center gap-2.5 p-3 flex-wrap">
                    <input
                      type="checkbox"
                      className={CHECKBOX}
                      checked={allInGroup}
                      ref={(el) => {
                        if (el) el.indeterminate = someInGroup
                      }}
                      onChange={() => toggleGroup(group)}
                      aria-label={`Select all lines for ${group.name}`}
                    />
                    <button
                      type="button"
                      className="flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer"
                      onClick={() => toggleCollapse(group.uniId)}
                      aria-expanded={!isCollapsed}
                    >
                      <ChevronDown
                        size={15}
                        className={`flex-none text-faint transition-transform duration-150 ${
                          isCollapsed ? '-rotate-90' : ''
                        }`}
                      />
                      <span className="text-[13px] font-bold text-text truncate">
                        {group.name}
                      </span>
                      <span className="text-[11.5px] text-faint whitespace-nowrap">
                        {selCount}/{keys.length} selected
                      </span>
                    </button>
                    <span className="ml-auto font-mono text-[13px] font-bold text-text tabular-nums">
                      {fmtMoney(subtotal)}
                    </span>
                  </div>

                  {!isCollapsed &&
                    group.lines.map((line) => {
                      const key = lineKey(line)
                      return (
                        <label
                          key={key}
                          className="flex items-center gap-2.5 flex-wrap py-2.5 px-3 border-t border-hair cursor-pointer transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--accent)_4%,transparent)]"
                        >
                          <input
                            type="checkbox"
                            className={CHECKBOX}
                            checked={selected.has(key)}
                            onChange={() => toggleLine(key)}
                          />
                          <span className="text-[13px] font-semibold text-text">
                            {EXCHANGE_META[line.exchange].label} ·{' '}
                            {formatMonth(line.monthYear)}
                          </span>
                          <span className="text-[12px] text-muted">
                            Fee paid: {fmtMoney(line.feePaid)}
                          </span>
                          <span className="ml-auto font-mono text-[13px] font-bold text-accent tabular-nums">
                            {fmtMoney(line.commission)}
                          </span>
                        </label>
                      )
                    })}
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Step 2 — payment method ───────────────────────────────────── */}
        <section
          className="rounded-card border border-border bg-surface p-card"
          data-aos="fade-up"
          data-aos-delay="100"
        >
          <div className="flex items-center gap-2.5 mb-4">
            <span className={STEP_NUM}>2</span>
            <div>
              <h2 className="font-display text-[16px] font-bold text-text">
                Payment method
              </h2>
              <p className="text-[12px] text-muted mt-0.5">
                How the commission was (or will be) sent to the referrer.
              </p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap mb-4">
            <button
              type="button"
              className={`${CHIP_BASE} inline-flex items-center gap-1.5 ${
                method === 'crypto'
                  ? 'bg-accent border-accent text-on-accent'
                  : 'border-border bg-surface2 text-muted hover:text-text hover:border-accent'
              }`}
              onClick={() => setMethod('crypto')}
            >
              <Wallet size={13} />
              Crypto (USDT)
            </button>
            <button
              type="button"
              className={`${CHIP_BASE} inline-flex items-center gap-1.5 ${
                method === 'bank_wire'
                  ? 'bg-accent border-accent text-on-accent'
                  : 'border-border bg-surface2 text-muted hover:text-text hover:border-accent'
              }`}
              onClick={() => setMethod('bank_wire')}
            >
              <Landmark size={13} />
              Bank wire
            </button>
          </div>

          {method === 'crypto' ? (
            <div>
              {data.wallets.length === 0 ? (
                <div className={WARN_BOX} role="alert">
                  <AlertCircle size={15} className="flex-none mt-px" />
                  <span>
                    No crypto wallet on file — the referrer must add a payout wallet
                    in their settings before a crypto release.
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Payout wallet">
                  {data.wallets.map((w) => (
                    <div
                      key={w.id}
                      role="radio"
                      aria-checked={walletId === w.id}
                      tabIndex={0}
                      className={`flex items-center gap-3 rounded-row border p-3 cursor-pointer transition-[border-color,background] duration-150 ${
                        walletId === w.id
                          ? 'border-accent bg-accent-soft'
                          : 'border-border bg-surface2 hover:border-accent-line'
                      }`}
                      onClick={() => setWalletId(w.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setWalletId(w.id)
                        }
                      }}
                    >
                      <span
                        className={`w-4 h-4 flex-none rounded-full border-2 grid place-items-center ${
                          walletId === w.id ? 'border-accent' : 'border-border'
                        }`}
                      >
                        {walletId === w.id && (
                          <span className="w-2 h-2 rounded-full bg-accent" />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-bold text-text">
                            {w.name}
                          </span>
                          <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.06em] px-[7px] py-0.5 rounded-pill border border-accent-line text-accent">
                            {w.network}
                          </span>
                          {w.isMain && <span className={PREFERRED_PILL}>Preferred</span>}
                        </div>
                        <p className="font-mono text-[12px] text-muted mt-1 [overflow-wrap:anywhere]">
                          {truncateAddress(w.address, 14, 10)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="inline-grid flex-none place-items-center w-7 h-7 rounded-[8px] border border-border bg-surface text-muted cursor-pointer transition-[border-color,color] duration-150 hover:text-text hover:border-accent"
                        onClick={(e) => {
                          e.stopPropagation()
                          copyWalletAddress(w)
                        }}
                        title="Copy address"
                        aria-label="Copy wallet address"
                      >
                        {copiedWalletId === w.id ? (
                          <Check size={12} className="text-green" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label className="flex flex-col gap-1.5 mt-4">
                <span className={LABEL}>TX HASH *</span>
                <input
                  type="text"
                  className="h-[42px] rounded-nav border border-border bg-surface2 px-3.5 text-[12.5px] font-mono text-text outline-none transition-colors duration-150 placeholder:text-faint focus:border-accent-line"
                  placeholder="Paste the Tron transaction hash"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                />
              </label>
            </div>
          ) : (
            <div>
              {data.bankAccounts.length === 0 ? (
                <div className={WARN_BOX} role="alert">
                  <AlertCircle size={15} className="flex-none mt-px" />
                  <span>
                    No bank wire account on file — the referrer must add one in their
                    settings before a bank release.
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Bank account">
                    {data.bankAccounts.map((b) => (
                      <div
                        key={b.id}
                        role="radio"
                        aria-checked={bankId === b.id}
                        tabIndex={0}
                        className={`flex items-center gap-3 rounded-row border p-3 cursor-pointer transition-[border-color,background] duration-150 ${
                          bankId === b.id
                            ? 'border-accent bg-accent-soft'
                            : 'border-border bg-surface2 hover:border-accent-line'
                        }`}
                        onClick={() => setBankId(b.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setBankId(b.id)
                          }
                        }}
                      >
                        <span
                          className={`w-4 h-4 flex-none rounded-full border-2 grid place-items-center ${
                            bankId === b.id ? 'border-accent' : 'border-border'
                          }`}
                        >
                          {bankId === b.id && (
                            <span className="w-2 h-2 rounded-full bg-accent" />
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13px] font-bold text-text">
                              {b.label}
                            </span>
                            <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.06em] px-[7px] py-0.5 rounded-pill border border-border text-muted">
                              {b.currency}
                            </span>
                            {b.isMain && (
                              <span className={PREFERRED_PILL}>Preferred</span>
                            )}
                          </div>
                          {b.bankName && (
                            <p className="text-[12px] text-muted mt-1">{b.bankName}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedBank && (
                    <div
                      key={selectedBank.id}
                      className="mt-3.5 rounded-row border border-border bg-surface2 p-3.5 animate-[fadeup_0.35s_ease-out]"
                    >
                      <p className="text-[10.5px] uppercase tracking-[0.07em] text-faint mb-2.5">
                        Wire details
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                        {(
                          [
                            ['Holder', selectedBank.accountHolder],
                            ['Bank', selectedBank.bankName],
                            ['Account #', selectedBank.accountNumber],
                            ['Routing #', selectedBank.routingNumber],
                            ['IBAN', selectedBank.iban],
                            ['SWIFT/BIC', selectedBank.swiftBic],
                            ['Type', selectedBank.accountType],
                            ['Address', selectedBank.bankAddress],
                          ] as [string, string | null][]
                        )
                          .filter(([, value]) => value !== null && value !== '')
                          .map(([label, value]) => (
                            <div key={label} className="min-w-0">
                              <p className="text-[10.5px] uppercase tracking-[0.05em] text-faint">
                                {label}
                              </p>
                              <p className="text-[13px] font-semibold text-text font-mono mt-0.5 [overflow-wrap:anywhere]">
                                {value}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="mt-4">
                <span className={LABEL}>PAYMENT PROOF *</span>
                <div
                  role="button"
                  tabIndex={0}
                  className={`mt-1.5 rounded-row border border-dashed p-5 text-center cursor-pointer transition-[border-color,background] duration-150 ${
                    dragOver
                      ? 'border-accent bg-accent-soft'
                      : 'border-border bg-surface2 hover:border-accent-line'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    const file = e.dataTransfer.files?.[0]
                    if (file) handleFile(file)
                  }}
                >
                  {proofFile ? (
                    <div className="flex flex-col items-center gap-2">
                      {proofPreview ? (
                        <img
                          src={proofPreview}
                          alt="Payment proof preview"
                          className="max-h-28 rounded-[8px] border border-border"
                        />
                      ) : (
                        <FileText size={28} className="text-accent" />
                      )}
                      <p className="text-[12.5px] font-semibold text-text [overflow-wrap:anywhere]">
                        {proofFile.name}
                      </p>
                      <p className="text-[11px] text-faint">
                        {(proofFile.size / 1024).toFixed(0)} KB · click or drop to replace
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload size={24} className="text-faint" />
                      <p className="text-[12.5px] font-semibold text-text">
                        Drop the payment proof here, or click to browse
                      </p>
                      <p className="text-[11px] text-faint">
                        JPEG, PNG, GIF, WebP or PDF · max 5 MB
                      </p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFile(file)
                      e.target.value = ''
                    }}
                  />
                </div>
                {fileError && (
                  <p className="text-red text-[12.5px] mt-2" role="alert">
                    {fileError}
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ── Sticky confirm bar ────────────────────────────────────────── */}
        <div className="sticky bottom-3 z-20 mt-5">
          <div className="rounded-card border border-border bg-surface shadow-[0_18px_50px_rgba(0,0,0,0.3)] p-3.5 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[12.5px] text-muted">
              <span className="font-mono font-bold text-text tabular-nums">
                {fmtMoney(total)}
              </span>{' '}
              · {selectedLines.length} line{selectedLines.length === 1 ? '' : 's'} ·{' '}
              {method === 'crypto' ? 'Crypto (USDT)' : 'Bank wire'}
            </p>
            <button
              type="button"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-pill bg-accent text-on-accent font-bold text-[13.5px] py-2.5 px-5 shadow-[0_10px_24px_var(--glow)] cursor-pointer transition-[filter] duration-150 enabled:hover:brightness-[1.06] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canSubmit || submitting}
              onClick={() => setConfirmOpen(true)}
            >
              <Send size={14} />
              {submitting ? 'Releasing…' : `Release ${fmtMoney(total)}`}
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Confirm Release"
        message={confirmMessage}
        confirmLabel={submitting ? 'Releasing…' : 'Yes, release'}
        cancelLabel="No"
        onConfirm={runRelease}
        onCancel={() => {
          if (!submitting) setConfirmOpen(false)
        }}
      />
    </AdminLayout>
  )
}
