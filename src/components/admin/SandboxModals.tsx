import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  AlertCircle,
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
import './SandboxModals.css'

/* ---- static option sets used by the forms + randomizer ---- */
const STATUS_OPTS: UserStatus[] = ['pending', 'active', 'suspended']
const ROLE_OPTS: UserRole[] = ['user', 'admin', 'master']
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT']
const STRATEGIES = ['Momentum', 'Mean Reversion', 'Breakout', 'Scalp', 'Trend Follow']

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const todayIso = () => new Date().toISOString().slice(0, 10)

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
    <label className={`asbxm__field${full ? ' asbxm__field--full' : ''}`}>
      <span className="asbxm__label">{label}</span>
      {children}
    </label>
  )
}

/**
 * Shared dialog chrome: fixed overlay (click to close) + Escape handler.
 * Each modal supplies its own `<form className="asbxm">` box as children.
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
      className="asbxm__overlay"
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
        className="asbxm"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="asbxm__head">
          <span className="dchip">
            <UserPlus size={16} />
          </span>
          <div className="asbxm__head-text">
            <div className="asbxm__title">Create Test User</div>
            <div className="asbxm__sub">
              Spin up a throwaway account to test the sign-up flow. Pending users
              land in User Management for approve / reject.
            </div>
          </div>
        </div>

        <div className="asbxm__fields">
          <Field label="Name" full>
            <input
              className="asbxm__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Test User"
            />
          </Field>
          <Field label="Email" full>
            <input
              className="asbxm__input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="auto-generated if blank"
            />
          </Field>
          <Field label="Password" full>
            <input
              className="asbxm__input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password123"
            />
          </Field>
          <Field label="Status">
            <select
              className="asbxm__input"
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
              className="asbxm__input"
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
          <div className="asbxm__msg asbxm__msg--err" role="alert">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <div className="asbxm__actions">
          <button
            type="button"
            className="asbxm__btn asbxm__btn--ghost"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="asbxm__btn asbxm__btn--primary"
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

  const countNum = Math.max(1, Math.min(200, Math.round(Number(count) || 1)))

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
    setClosedAt(d.toISOString().slice(0, 10))
  }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!targetUni) {
      setError('Select a target user first.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const { inserted, account } = await insertPastPositions({
        uni_id: targetUni,
        count: countNum,
        randomize: countNum > 1 && randomizeEach,
        position: {
          symbol: symbol.trim().toUpperCase(),
          position_side: side,
          position_amt: Number(qty) || 0,
          entry_price: Number(entry) || 0,
          exit_price: Number(exit) || 0,
          realized_pnl: Number(pnl) || 0,
          strategy: strategy.trim(),
          closed_at: closedAt,
        },
      })
      onSuccess(
        `Inserted ${inserted} position${inserted === 1 ? '' : 's'} into account ${account.name}.`,
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
        className="asbxm asbxm--wide"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="asbxm__head">
          <span className="dchip">
            <FlaskConical size={16} />
          </span>
          <div className="asbxm__head-text">
            <div className="asbxm__title">Insert Past Position</div>
            <div className="asbxm__sub">
              Add fabricated closed trades to a user's history. Stats on the
              Dashboard / Strategies / Analytics pages update from these rows.
            </div>
          </div>
        </div>

        <div className="asbxm__fields">
          <Field label="Target user" full>
            <select
              className="asbxm__input"
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

          <Field label="Symbol">
            <input
              className="asbxm__input"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="BTCUSDT"
            />
          </Field>
          <Field label="Side">
            <select
              className="asbxm__input"
              value={side}
              onChange={(e) => setSide(e.target.value as 'LONG' | 'SHORT')}
            >
              <option value="LONG">LONG</option>
              <option value="SHORT">SHORT</option>
            </select>
          </Field>

          <Field label="Quantity">
            <input
              className="asbxm__input"
              type="number"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </Field>
          <Field label="Realized P&L">
            <input
              className="asbxm__input"
              type="number"
              step="any"
              value={pnl}
              onChange={(e) => setPnl(e.target.value)}
            />
          </Field>

          <Field label="Entry price">
            <input
              className="asbxm__input"
              type="number"
              step="any"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
            />
          </Field>
          <Field label="Exit price">
            <input
              className="asbxm__input"
              type="number"
              step="any"
              value={exit}
              onChange={(e) => setExit(e.target.value)}
            />
          </Field>

          <Field label="Strategy">
            <input
              className="asbxm__input"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              placeholder="Momentum"
            />
          </Field>
          <Field label="Closed at">
            <input
              className="asbxm__input"
              type="date"
              value={closedAt}
              onChange={(e) => setClosedAt(e.target.value)}
            />
          </Field>

          <Field label="Count (1–200)">
            <input
              className="asbxm__input"
              type="number"
              min={1}
              max={200}
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </Field>
          <label
            className={`asbxm__check${countNum > 1 ? '' : ' asbxm__check--off'}`}
          >
            <input
              type="checkbox"
              checked={randomizeEach}
              disabled={countNum <= 1}
              onChange={(e) => setRandomizeEach(e.target.checked)}
            />
            Randomize each row
          </label>
        </div>

        {error && (
          <div className="asbxm__msg asbxm__msg--err" role="alert">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <div className="asbxm__actions">
          <button
            type="button"
            className="asbxm__btn asbxm__btn--ghost asbxm__actions-left"
            onClick={randomizeFields}
            disabled={saving}
          >
            <Dices size={15} />
            Randomize fields
          </button>
          <button
            type="button"
            className="asbxm__btn asbxm__btn--ghost"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="asbxm__btn asbxm__btn--primary"
            disabled={saving || users.length === 0}
          >
            <FlaskConical size={15} />
            {saving ? 'Inserting…' : 'Insert position(s)'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
