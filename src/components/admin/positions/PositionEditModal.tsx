import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Lock } from 'lucide-react'
import { displaySymbol } from '../../../lib/chart'
import type { PositionRow } from '../../../lib/adminPositionRows'
import type { AdminPastTradeUpdate, AdminPositionUpdate } from '../../../types/admin'

/* ---- shared class strings (same vocabulary as ApiKeyEditModal) ---- */
const FIELD = 'flex flex-col gap-1.5'
const FIELD_LABEL = 'text-[12px] font-semibold text-muted'
const FIELD_HINT = 'text-[11px] text-faint'
const CONTROL =
  'h-[42px] w-full border border-border rounded-field bg-surface2 px-3 text-[13.5px] text-text outline-none font-body focus:border-accent'
const BTN_BASE =
  'h-10 px-[18px] rounded-pill text-[13px] font-bold font-body disabled:opacity-60 disabled:cursor-not-allowed'

export type PositionEditKind = 'position' | 'trade'

/** What the form hands back: the payload plus a human summary of what actually
 *  changed, which the confirm step reads out before anything is written. */
export type PositionEditPayload =
  | { kind: 'position'; id: number; input: AdminPositionUpdate; changes: string[] }
  | { kind: 'trade'; id: number; input: AdminPastTradeUpdate; changes: string[] }

interface Props {
  /** null = closed. Always a single DB row — merged rows are not editable. */
  row: PositionRow | null
  kind: PositionEditKind
  saving: boolean
  error: string | null
  /** True while the confirm step is on top: Escape must not close this form. */
  confirming: boolean
  /** Replaces the account line under the title — the daily-P&L calendar opens
   *  this on the viewer's own trades, where "account ID" says nothing. */
  subtitle?: string
  onSubmit: (payload: PositionEditPayload) => void
  onCancel: () => void
}

/** 'YYYY-MM-DD HH:MM:SS' ⇄ the datetime-local value, as strings — never through
 *  a Date, which would shift the stored wall-clock time by the browser's zone. */
function toLocalInput(v: string): string {
  return v.replace(' ', 'T').slice(0, 16)
}
function fromLocalInput(v: string): string {
  const s = v.replace('T', ' ')
  return s.length === 16 ? `${s}:00` : s
}

function num(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Correct one position / closed trade row.
 *
 * The editable set is exactly what the table shows — the row's account is NOT
 * among it: `api_key`/`uni_id` are what tie a row to its invoices and to the
 * published track record, so a mis-owned row is deleted and re-synced rather
 * than moved to another user.
 */
export default function PositionEditModal({
  row,
  kind,
  saving,
  error,
  confirming,
  subtitle,
  onSubmit,
  onCancel,
}: Props) {
  const trade = kind === 'trade'

  const [symbol, setSymbol] = useState('')
  const [side, setSide] = useState('')
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const [pnl, setPnl] = useState('')
  const [strategy, setStrategy] = useState('')
  const [closedAt, setClosedAt] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!row) return
    setSymbol(row.symbol)
    setSide(row.side ?? (kind === 'trade' ? 'BUY' : 'BOTH'))
    setQty(String(row.qty ?? 0))
    setPrice(String(row.price))
    setPnl(String(row.pnl))
    setStrategy(row.strategy ?? '')
    setClosedAt(row.closedAt ? toLocalInput(row.closedAt) : '')
    setFormError(null)
  }, [row, kind])

  useEffect(() => {
    if (!row || confirming) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [row, confirming, onCancel])

  if (!row || row.rowId === null) return null

  const id = row.rowId

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const nextSymbol = symbol.trim().toUpperCase()
    const nextQty = num(qty)
    const nextPrice = num(price)
    const nextPnl = num(pnl)

    if (!nextSymbol) return setFormError('Ticker is required.')
    if (nextQty === null) return setFormError('Quantity must be a number.')
    if (nextPrice === null) return setFormError('Price must be a number.')
    if (nextPnl === null) return setFormError('P&L must be a number.')
    if (trade && !closedAt) return setFormError('Close date is required.')

    const changes: string[] = []
    const note = (label: string, before: string, after: string) => {
      if (before !== after) changes.push(`${label} ${before} → ${after}`)
    }
    note('Ticker', displaySymbol(row.symbol), displaySymbol(nextSymbol))
    note('Side', row.side ?? '—', side)
    note('Quantity', String(row.qty ?? 0), String(nextQty))
    note(trade ? 'Exit price' : 'Mark price', String(row.price), String(nextPrice))
    note(trade ? 'Realized P&L' : 'Unrealized P&L', String(row.pnl), String(nextPnl))
    if (trade) {
      note('Strategy', row.strategy ?? '—', strategy.trim() || '—')
      note('Closed at', row.closedAt ? toLocalInput(row.closedAt) : '—', closedAt)
    }

    if (changes.length === 0) return setFormError('Nothing changed.')
    setFormError(null)

    onSubmit(
      trade
        ? {
            kind: 'trade',
            id,
            changes,
            input: {
              symbol: nextSymbol,
              side,
              position_amt: nextQty,
              exit_price: nextPrice,
              realized_pnl: nextPnl,
              strategy: strategy.trim() || null,
              closed_at: fromLocalInput(closedAt),
            },
          }
        : {
            kind: 'position',
            id,
            changes,
            input: {
              symbol: nextSymbol,
              position_side: side,
              position_amt: nextQty,
              mark_price: nextPrice,
              unrealized_profit: nextPnl,
            },
          },
    )
  }

  const shown = formError ?? error

  // Portaled into <body>: callers sit inside cards carrying `data-aos`, and AOS
  // animates with `transform`, which makes that card the containing block for a
  // `position: fixed` child — the overlay would be trapped inside it.
  return createPortal(
    <div
      className="fixed inset-0 z-[110] grid place-items-center p-5 bg-black/55"
      onClick={confirming ? undefined : onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={trade ? 'Edit closed trade' : 'Edit open position'}
    >
      <form
        className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto bg-surface border border-border rounded-[18px] p-[26px] flex flex-col gap-3.5"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h3 className="font-display text-[20px] font-extrabold">
          Edit {trade ? 'Trade' : 'Position'} #{id}
        </h3>
        <p className="text-[13px] text-muted -mt-2">
          {subtitle ??
            `${row.accountName ?? 'Unknown account'} · account ID ${row.accountId ?? '—'} · ${row.broker}`}
        </p>

        {/* what this edit really means, per row kind */}
        <p
          className={`flex items-start gap-2 rounded-[12px] border p-3 text-[11.5px] leading-[1.55] ${
            trade
              ? 'border-[color-mix(in_srgb,var(--red)_30%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] text-red'
              : 'border-accent-line bg-accent-soft text-muted'
          }`}
        >
          <AlertTriangle size={13} className="mt-px flex-none" />
          {trade
            ? 'Realized P&L and the close date are read by invoicing and by the public track record — correcting them changes what this customer is billed.'
            : 'The positions poller replaces this account’s rows on its next sync, so this corrects the display until then. It never reaches Binance.'}
        </p>

        <div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
          <label className={FIELD}>
            <span className={FIELD_LABEL}>Ticker *</span>
            <input
              type="text"
              className={`${CONTROL} font-mono uppercase`}
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              maxLength={32}
              required
            />
          </label>

          <label className={FIELD}>
            <span className={FIELD_LABEL}>Side</span>
            <select
              className={`${CONTROL} cursor-pointer`}
              value={side}
              onChange={(e) => setSide(e.target.value)}
            >
              {(trade ? ['BUY', 'SELL'] : ['BOTH', 'LONG', 'SHORT']).map((s) => (
                <option key={s} className="bg-surface text-text" value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className={FIELD}>
            <span className={FIELD_LABEL}>Quantity</span>
            <input
              type="number"
              step="any"
              className={`${CONTROL} font-mono`}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
            <small className={FIELD_HINT}>
              {trade ? 'Closed size.' : 'Signed: + long, − short.'}
            </small>
          </label>

          <label className={FIELD}>
            <span className={FIELD_LABEL}>{trade ? 'Exit price' : 'Mark price'}</span>
            <input
              type="number"
              step="any"
              className={`${CONTROL} font-mono`}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>

          <label className={FIELD}>
            <span className={FIELD_LABEL}>
              {trade ? 'Realized P&L' : 'Unrealized P&L'}
            </span>
            <input
              type="number"
              step="any"
              className={`${CONTROL} font-mono`}
              value={pnl}
              onChange={(e) => setPnl(e.target.value)}
            />
            <small className={FIELD_HINT}>In USDT, as stored.</small>
          </label>

          {trade && (
            <label className={FIELD}>
              <span className={FIELD_LABEL}>Closed at *</span>
              <input
                type="datetime-local"
                className={`${CONTROL} font-mono`}
                value={closedAt}
                onChange={(e) => setClosedAt(e.target.value)}
                required
              />
            </label>
          )}

          {trade && (
            <label className={`${FIELD} col-span-2 max-[520px]:col-span-1`}>
              <span className={FIELD_LABEL}>Strategy</span>
              <input
                type="text"
                className={CONTROL}
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                maxLength={100}
                placeholder="e.g. VWMA-Reversion"
              />
            </label>
          )}
        </div>

        <p className="flex items-start gap-1.5 text-[11px] text-faint">
          <Lock size={12} className="mt-px flex-none" />
          The owning account is not editable — it is what joins this row to its
          invoices. A row on the wrong account is deleted and re-synced.
        </p>

        {shown && (
          <p
            className="py-2.5 px-3.5 border border-[rgba(239,68,68,0.35)] rounded-field bg-[rgba(239,68,68,0.08)] text-[#ef4444] text-[13px]"
            role="alert"
          >
            {shown}
          </p>
        )}

        <div className="flex justify-end gap-2.5 mt-1">
          <button
            type="button"
            className={`${BTN_BASE} border border-border bg-surface2 text-text`}
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`${BTN_BASE} border-0 bg-accent text-on-accent`}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
