import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  AlertCircle,
  CalendarRange,
  Dices,
  FlaskConical,
  UserPlus,
} from 'lucide-react'
import { createTestUser, insertPastPositions } from '../../services/admin'
import { getApiErrorMessage } from '../../services/api'
import type {
  AdminUser,
  SandboxUser,
  TestUserInput,
  UserRole,
  UserStatus,
} from '../../types/admin'

/* ---- static option sets used by the forms + randomizer ---- */
const STATUS_OPTS: UserStatus[] = ['pending', 'active', 'suspended']
const ROLE_OPTS: UserRole[] = ['user', 'admin', 'master', 'developer']
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT']
const STRATEGIES = ['Momentum', 'Mean Reversion', 'Breakout', 'Scalp', 'Trend Follow']

/** Rows one date-range insert may produce — mirrors the API's own cap. */
const MAX_RANGE_DAYS = 366

const MODE_OPTS = [
  { value: 'count' as const, label: 'Fixed count', icon: <FlaskConical size={13} /> },
  { value: 'range' as const, label: 'Date range', icon: <CalendarRange size={13} /> },
]

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

/** Local (not UTC) 'YYYY-MM-DD' — what `<input type="date">` expects. */
const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`

const todayIso = () => isoDay(new Date())

const daysAgoIso = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return isoDay(d)
}

/** Inclusive day count of a range, or 0 when the range is invalid. */
const rangeDays = (from: string, to: string) => {
  const a = Date.parse(`${from}T00:00:00`)
  const b = Date.parse(`${to}T00:00:00`)
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0
  return Math.round((b - a) / 86_400_000) + 1
}

/* ---- token-mapped class strings (was SandboxModals.css) ---- */
const CHIP =
  'w-7 h-7 flex-none grid place-items-center rounded-[9px] bg-accent-soft border border-accent-line text-accent'
const INPUT =
  'h-10 w-full rounded-[10px] border border-border bg-surface2 px-[13px] text-[13px] text-text outline-none font-body transition-[border-color] duration-150 focus:border-accent placeholder:text-faint'
const SELECT = `${INPUT} cursor-pointer [&>option]:bg-surface [&>option]:text-text`
const MSG_ERR =
  'flex items-start gap-2 rounded-[10px] border py-2.5 px-[13px] text-[12.5px] leading-[1.5] border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] text-red'
const BTN =
  'inline-flex items-center gap-[7px] h-10 rounded-pill border border-transparent px-[18px] text-[13px] font-bold cursor-pointer font-body transition-[filter,border-color,background,opacity] duration-150 disabled:opacity-[0.55] disabled:cursor-not-allowed'
const BTN_PRIMARY = 'bg-accent text-on-accent enabled:hover:brightness-[1.08]'
const BTN_GHOST = 'bg-surface2 border-border text-text enabled:hover:border-accent'

/** Label + control wrapper, keeps the modal fields tidy and evenly spaced. */
function Field({
  label,
  full,
  children,
}: {
  label: string
  full?: boolean
  children: ReactNode
}) {
  return (
    <label className={`flex flex-col gap-1.5 min-w-0${full ? ' col-span-full' : ''}`}>
      <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.08em] uppercase text-faint">
        {label}
      </span>
      {children}
    </label>
  )
}

/**
 * Shared dialog chrome: fixed overlay (click to close) + Escape handler.
 * Each modal supplies its own `<form>` panel box as children.
 */
function ModalShell({
  onClose,
  ariaLabel,
  children,
}: {
  onClose: () => void
  ariaLabel: string
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center p-5 bg-[rgba(0,0,0,0.55)]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  )
}

/* ================= Create Test User ================= */

interface UserModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (user: SandboxUser) => void
}

export function SandboxUserModal({ open, onClose, onSuccess }: UserModalProps) {
  const [name, setName] = useState('Test User')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('password123')
  const [status, setStatus] = useState<UserStatus>('pending')
  const [role, setRole] = useState<UserRole>('user')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset to defaults each time the modal is opened.
  useEffect(() => {
    if (!open) return
    setName('Test User')
    setEmail('')
    setPassword('password123')
    setStatus('pending')
    setRole('user')
    setSaving(false)
    setError(null)
  }, [open])

  if (!open) return null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const input: TestUserInput = { name, password, status, type: role }
    if (email.trim()) input.email = email.trim()
    try {
      const user = await createTestUser(input)
      onSuccess(user)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create the test user.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell onClose={onClose} ariaLabel="Create test user">
      <form
        className="w-full max-w-[480px] max-h-[90vh] overflow-y-auto bg-surface border border-border rounded-[18px] p-[26px] flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="flex items-start gap-3">
          <span className={CHIP}>
            <UserPlus size={16} />
          </span>
          <div className="min-w-0">
            <div className="font-display text-[19px] font-extrabold">
              Create Test User
            </div>
            <div className="text-[12.5px] text-muted mt-0.5 leading-[1.5]">
              Spin up a throwaway account to test the sign-up flow. Pending users
              land in User Management for approve / reject.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 max-[560px]:grid-cols-1 gap-x-4 gap-y-3.5">
          <Field label="Name" full>
            <input
              className={INPUT}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Test User"
            />
          </Field>
          <Field label="Email" full>
            <input
              className={INPUT}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="auto-generated if blank"
            />
          </Field>
          <Field label="Password" full>
            <input
              className={INPUT}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password123"
            />
          </Field>
          <Field label="Status">
            <select
              className={SELECT}
              value={status}
              onChange={(e) => setStatus(e.target.value as UserStatus)}
            >
              {STATUS_OPTS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Role">
            <select
              className={SELECT}
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              {ROLE_OPTS.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {error && (
          <div className={MSG_ERR} role="alert">
            <AlertCircle size={15} className="flex-none mt-px" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2.5 mt-0.5">
          <button
            type="button"
            className={`${BTN} ${BTN_GHOST}`}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`${BTN} ${BTN_PRIMARY}`}
            disabled={saving}
          >
            <UserPlus size={15} />
            {saving ? 'Creating…' : 'Create user'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

/* ================= Insert Past Position ================= */

interface PositionModalProps {
  open: boolean
  onClose: () => void
  users: AdminUser[]
  onSuccess: (message: string) => void
}

export function SandboxPositionModal({
  open,
  onClose,
  users,
  onSuccess,
}: PositionModalProps) {
  const [targetUni, setTargetUni] = useState('')
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG')
  const [qty, setQty] = useState('0.5')
  const [entry, setEntry] = useState('60000')
  const [exit, setExit] = useState('60250')
  const [pnl, setPnl] = useState('125.5')
  const [strategy, setStrategy] = useState('Momentum')
  const [closedAt, setClosedAt] = useState(todayIso())
  const [count, setCount] = useState('1')
  const [mode, setMode] = useState<'count' | 'range'>('count')
  const [dateFrom, setDateFrom] = useState(daysAgoIso(29))
  const [dateTo, setDateTo] = useState(todayIso())
  const [pnlMin, setPnlMin] = useState('-250')
  const [pnlMax, setPnlMax] = useState('600')
  const [randomizeEach, setRandomizeEach] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // On open, reset feedback and default the target to the first user.
  useEffect(() => {
    if (!open) return
    setSaving(false)
    setError(null)
    setTargetUni((prev) => prev || users[0]?.uni_id || '')
  }, [open, users])

  if (!open) return null

  const isRange = mode === 'range'
  const countNum = Math.max(1, Math.min(200, Math.round(Number(count) || 1)))
  const dayCount = rangeDays(dateFrom, dateTo)
  const rowCount = isRange ? dayCount : countNum

  const randomizeFields = () => {
    const e = +(Math.random() * 60000 + 100).toFixed(2)
    const x = +(e * (1 + (Math.random() * 0.1 - 0.05))).toFixed(2)
    const d = new Date()
    d.setDate(d.getDate() - Math.floor(Math.random() * 60))
    setSymbol(pick(SYMBOLS))
    setSide(Math.random() < 0.5 ? 'LONG' : 'SHORT')
    setQty((Math.random() * 2 + 0.05).toFixed(3))
    setEntry(String(e))
    setExit(String(x))
    setPnl(((Math.random() < 0.55 ? 1 : -1) * (Math.random() * 400 + 10)).toFixed(2))
    setStrategy(pick(STRATEGIES))
    setClosedAt(isoDay(d))
  }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!targetUni) {
      setError('Select a target user first.')
      return
    }
    if (isRange) {
      if (dayCount === 0) {
        setError('Pick a valid date range — the end date cannot be before the start date.')
        return
      }
      if (dayCount > MAX_RANGE_DAYS) {
        setError(`That range covers ${dayCount} days; the maximum is ${MAX_RANGE_DAYS}.`)
        return
      }
    }
    setSaving(true)
    setError(null)
    try {
      const { inserted, account } = await insertPastPositions({
        uni_id: targetUni,
        randomize: rowCount > 1 && randomizeEach,
        ...(isRange
          ? {
              mode: 'range' as const,
              date_from: dateFrom,
              date_to: dateTo,
              pnl_min: Number(pnlMin) || 0,
              pnl_max: Number(pnlMax) || 0,
            }
          : { count: countNum }),
        position: {
          symbol: symbol.trim().toUpperCase(),
          position_side: side,
          position_amt: Number(qty) || 0,
          entry_price: Number(entry) || 0,
          exit_price: Number(exit) || 0,
          realized_pnl: Number(pnl) || 0,
          strategy: strategy.trim(),
          closed_at: isRange ? dateFrom : closedAt,
        },
      })
      onSuccess(
        isRange
          ? `Inserted ${inserted} position${inserted === 1 ? '' : 's'} — one per day from ${dateFrom} to ${dateTo} — into account ${account.name}.`
          : `Inserted ${inserted} position${inserted === 1 ? '' : 's'} into account ${account.name}.`,
      )
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not insert positions.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell onClose={onClose} ariaLabel="Insert past position">
      <form
        className="w-full max-w-[620px] max-h-[90vh] overflow-y-auto bg-surface border border-border rounded-[18px] p-[26px] flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="flex items-start gap-3">
          <span className={CHIP}>
            <FlaskConical size={16} />
          </span>
          <div className="min-w-0">
            <div className="font-display text-[19px] font-extrabold">
              Insert Past Position
            </div>
            <div className="text-[12.5px] text-muted mt-0.5 leading-[1.5]">
              Add fabricated closed trades to a user's history. Stats on the
              Dashboard / Strategies / Analytics pages update from these rows.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 max-[560px]:grid-cols-1 gap-x-4 gap-y-3.5">
          <Field label="Target user" full>
            <select
              className={SELECT}
              value={targetUni}
              onChange={(e) => setTargetUni(e.target.value)}
            >
              {users.length === 0 && <option value="">No users</option>}
              {users.map((u) => (
                <option key={u.uni_id} value={u.uni_id}>
                  {u.name} — {u.email}
                </option>
              ))}
            </select>
          </Field>

          {/* Fixed count vs. one row per day across a date range. */}
          <div className="col-span-full flex flex-col gap-1.5 min-w-0">
            <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.08em] uppercase text-faint">
              Insert mode
            </span>
            <div className="inline-flex self-start items-center gap-1 rounded-pill border border-border bg-surface2 p-1">
              {MODE_OPTS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  className={`inline-flex items-center gap-1.5 h-8 rounded-pill px-3.5 text-[12px] font-bold cursor-pointer font-body transition-[background,color] duration-150 ${
                    mode === m.value
                      ? 'bg-accent text-on-accent'
                      : 'bg-transparent text-muted hover:text-text'
                  }`}
                  onClick={() => setMode(m.value)}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <Field label="Symbol">
            <input
              className={INPUT}
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="BTCUSDT"
            />
          </Field>
          <Field label="Side">
            <select
              className={SELECT}
              value={side}
              onChange={(e) => setSide(e.target.value as 'LONG' | 'SHORT')}
            >
              <option value="LONG">LONG</option>
              <option value="SHORT">SHORT</option>
            </select>
          </Field>

          <Field label="Quantity">
            <input
              className={INPUT}
              type="number"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </Field>
          <Field label="Entry price">
            <input
              className={INPUT}
              type="number"
              step="any"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
            />
          </Field>

          {isRange ? (
            <>
              <Field label="From date">
                <input
                  className={INPUT}
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </Field>
              <Field label="To date">
                <input
                  className={INPUT}
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </Field>

              <Field label="Min realized P&L">
                <input
                  className={INPUT}
                  type="number"
                  step="any"
                  value={pnlMin}
                  onChange={(e) => setPnlMin(e.target.value)}
                />
              </Field>
              <Field label="Max realized P&L">
                <input
                  className={INPUT}
                  type="number"
                  step="any"
                  value={pnlMax}
                  onChange={(e) => setPnlMax(e.target.value)}
                />
              </Field>

              <div
                className={`col-span-full flex items-start gap-2 rounded-[10px] border py-2.5 px-[13px] text-[12.5px] leading-[1.5] ${
                  dayCount > 0 && dayCount <= MAX_RANGE_DAYS
                    ? 'border-accent-line bg-accent-soft text-muted'
                    : 'border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] text-red'
                }`}
              >
                <CalendarRange size={15} className="flex-none mt-px" />
                <span>
                  {dayCount === 0
                    ? 'The end date cannot be before the start date.'
                    : dayCount > MAX_RANGE_DAYS
                      ? `That range covers ${dayCount} days — the maximum is ${MAX_RANGE_DAYS}.`
                      : `${dayCount} position${dayCount === 1 ? '' : 's'} — one per day from ${dateFrom} to ${dateTo}, each with a realized P&L rolled between ${pnlMin || 0} and ${pnlMax || 0} and the exit price back-solved to match.`}
                </span>
              </div>

              <Field label="Strategy">
                <input
                  className={INPUT}
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  placeholder="Momentum"
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Realized P&L">
                <input
                  className={INPUT}
                  type="number"
                  step="any"
                  value={pnl}
                  onChange={(e) => setPnl(e.target.value)}
                />
              </Field>
              <Field label="Exit price">
                <input
                  className={INPUT}
                  type="number"
                  step="any"
                  value={exit}
                  onChange={(e) => setExit(e.target.value)}
                />
              </Field>

              <Field label="Strategy">
                <input
                  className={INPUT}
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  placeholder="Momentum"
                />
              </Field>
              <Field label="Closed at">
                <input
                  className={INPUT}
                  type="date"
                  value={closedAt}
                  onChange={(e) => setClosedAt(e.target.value)}
                />
              </Field>

              <Field label="Count (1–200)">
                <input
                  className={INPUT}
                  type="number"
                  min={1}
                  max={200}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              </Field>
            </>
          )}

          <label
            className={`inline-flex items-center gap-2 h-10 text-[12.5px] text-muted select-none ${
              rowCount > 1 ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
            }`}
          >
            <input
              type="checkbox"
              className="w-[15px] h-[15px] accent-[var(--accent)] cursor-pointer"
              checked={randomizeEach}
              disabled={rowCount <= 1}
              onChange={(e) => setRandomizeEach(e.target.checked)}
            />
            Randomize each row
          </label>
        </div>

        {error && (
          <div className={MSG_ERR} role="alert">
            <AlertCircle size={15} className="flex-none mt-px" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2.5 mt-0.5">
          <button
            type="button"
            className={`${BTN} ${BTN_GHOST} mr-auto`}
            onClick={randomizeFields}
            disabled={saving}
          >
            <Dices size={15} />
            Randomize fields
          </button>
          <button
            type="button"
            className={`${BTN} ${BTN_GHOST}`}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`${BTN} ${BTN_PRIMARY}`}
            disabled={
              saving ||
              users.length === 0 ||
              (isRange && (dayCount === 0 || dayCount > MAX_RANGE_DAYS))
            }
          >
            <FlaskConical size={15} />
            {saving
              ? 'Inserting…'
              : isRange
                ? `Insert ${dayCount} position${dayCount === 1 ? '' : 's'}`
                : 'Insert position(s)'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
