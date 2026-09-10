import { useEffect, useState, type FormEvent } from 'react'
import { Eye, EyeOff, RefreshCw, ShieldAlert } from 'lucide-react'
import type { AdminUserCreateInput, UserRole, UserStatus } from '../../types/admin'

/* ---- shared class strings (same vocabulary as AssetFormModal) ---- */
const FIELD = 'flex flex-col gap-1.5'
const FIELD_LABEL = 'text-[12px] font-semibold text-muted'
const FIELD_HINT = 'text-[11px] text-faint'
const CONTROL =
  'h-[42px] w-full border border-border rounded-field bg-surface2 px-3 text-[13.5px] text-text outline-none font-body focus:border-accent'
const SELECT = `${CONTROL} [&>option]:bg-surface [&>option]:text-text`
const BTN_BASE =
  'h-10 px-[18px] rounded-pill text-[13px] font-bold font-body disabled:opacity-60 disabled:cursor-not-allowed'

const ROLES: { value: UserRole; label: string; hint: string }[] = [
  { value: 'user', label: 'User', hint: 'Trader dashboard only.' },
  {
    value: 'admin',
    label: 'Admin',
    hint: 'Admin portal — users, invoices, engine and assets. Not the database console.',
  },
  {
    value: 'developer',
    label: 'Developer',
    hint: 'Admin portal plus the database console; payments run against the providers’ sandbox.',
  },
  {
    value: 'master',
    label: 'Master',
    hint: 'The house account the master stats and public track record read from. Only one may exist.',
  },
]

const STATUSES: { value: UserStatus; label: string; hint: string }[] = [
  { value: 'active', label: 'Active', hint: 'Can sign in and connect an exchange right away.' },
  { value: 'pending', label: 'Pending', hint: 'Lands in the approval queue like a normal sign-up.' },
  { value: 'suspended', label: 'Suspended', hint: 'Blocked from signing in until reactivated.' },
]

/** Fee defaults the API applies when the fields are left blank. */
const FEE_DEFAULTS = { realized: '20', unrealized: '6', affiliate: '20' }

/** Character pool for the generated password — no ambiguous 0/O/1/l. */
const PW_POOL = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'

function generatePassword(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(16))
  return Array.from(bytes, (b) => PW_POOL[b % PW_POOL.length]).join('')
}

interface CreateUserModalProps {
  open: boolean
  saving: boolean
  error: string | null
  onSubmit: (input: AdminUserCreateInput) => void
  onCancel: () => void
}

/**
 * Admin-side "create an account by hand" form. Only name/email/password are
 * required — role, status and the fee percentages carry the API's defaults,
 * so the common case is three fields and Enter.
 */
export default function CreateUserModal({
  open,
  saving,
  error,
  onSubmit,
  onCancel,
}: CreateUserModalProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<UserRole>('user')
  const [status, setStatus] = useState<UserStatus>('active')
  const [showFees, setShowFees] = useState(false)
  const [realized, setRealized] = useState('')
  const [unrealized, setUnrealized] = useState('')
  const [affiliate, setAffiliate] = useState('')

  // Blank every field on each open — a modal that remembers the last user's
  // details is how a wrong email gets submitted twice.
  useEffect(() => {
    if (!open) return
    setName('')
    setEmail('')
    setPassword('')
    setShowPassword(false)
    setRole('user')
    setStatus('active')
    setShowFees(false)
    setRealized('')
    setUnrealized('')
    setAffiliate('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  const roleHint = ROLES.find((r) => r.value === role)?.hint
  const statusHint = STATUSES.find((s) => s.value === status)?.hint
  const elevated = role !== 'user'

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const input: AdminUserCreateInput = {
      name: name.trim(),
      email: email.trim(),
      password,
      type: role,
      status,
    }
    // Blank = "use the API default" — never send NaN or 0 for an empty box.
    if (realized.trim() !== '') input.realized_percentage = Number(realized)
    if (unrealized.trim() !== '') input.unrealized_percentage = Number(unrealized)
    if (affiliate.trim() !== '') input.affiliate_percentage = Number(affiliate)
    onSubmit(input)
  }

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center p-5 bg-black/55"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Create user"
    >
      <form
        className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto bg-surface border border-border rounded-[18px] p-[26px] flex flex-col gap-3.5"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h3 className="font-display text-[20px] font-extrabold">Create User</h3>
        <p className="text-[13px] text-muted -mt-2">
          Adds a real account straight away — no sign-up, no email verification.
          Send the person their password yourself.
        </p>

        <label className={FIELD}>
          <span className={FIELD_LABEL}>Full name *</span>
          <input
            type="text"
            className={CONTROL}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jane Cooper"
            maxLength={255}
            autoComplete="off"
            required
          />
        </label>

        <label className={FIELD}>
          <span className={FIELD_LABEL}>Email *</span>
          <input
            type="email"
            className={CONTROL}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            maxLength={255}
            autoComplete="off"
            required
          />
        </label>

        <div className={FIELD}>
          <span className={FIELD_LABEL}>Password *</span>
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <input
                type={showPassword ? 'text' : 'password'}
                className={`${CONTROL} pr-10 font-mono`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-7 h-7 rounded-[8px] text-muted hover:text-accent"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <button
              type="button"
              className="inline-flex flex-none items-center gap-[5px] h-[42px] px-3 border border-border rounded-field bg-surface2 text-text text-[12px] font-semibold hover:border-accent"
              onClick={() => {
                setPassword(generatePassword())
                setShowPassword(true)
              }}
            >
              <RefreshCw size={13} />
              Generate
            </button>
          </div>
          <small className={FIELD_HINT}>
            Minimum 8 characters. The user can change it from Settings after
            signing in.
          </small>
        </div>

        <div className="grid grid-cols-2 gap-3 max-[560px]:grid-cols-1">
          <label className={FIELD}>
            <span className={FIELD_LABEL}>Role</span>
            <select
              className={SELECT}
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className={FIELD}>
            <span className={FIELD_LABEL}>Status</span>
            <select
              className={SELECT}
              value={status}
              onChange={(e) => setStatus(e.target.value as UserStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-1 -mt-1.5">
          <small className={FIELD_HINT}>{roleHint}</small>
          <small className={FIELD_HINT}>{statusHint}</small>
        </div>

        {elevated && (
          <p className="flex items-start gap-2 rounded-field border border-accent-line bg-accent-soft px-3 py-2.5 text-[12.5px] text-text">
            <ShieldAlert size={15} className="mt-px flex-none text-accent" />
            <span>
              This account gets admin-portal access as soon as it is created.
            </span>
          </p>
        )}

        {/* Fees are collapsed by default — the defaults are right nearly always */}
        <button
          type="button"
          className="self-start text-[12.5px] font-bold text-accent hover:underline"
          onClick={() => setShowFees((v) => !v)}
        >
          {showFees ? 'Hide fee percentages' : 'Set fee percentages (optional)'}
        </button>

        {showFees && (
          <div className="flex flex-col gap-3 rounded-[12px] border border-hair bg-surface2 p-3.5 animate-[fadeup_0.25s_ease-out]">
            <div className="grid grid-cols-3 gap-3 max-[560px]:grid-cols-1">
              <label className={FIELD}>
                <span className={FIELD_LABEL}>Realized %</span>
                <input
                  type="number"
                  className={CONTROL}
                  value={realized}
                  onChange={(e) => setRealized(e.target.value)}
                  placeholder={FEE_DEFAULTS.realized}
                  min="0"
                  max="100"
                  step="0.01"
                />
              </label>
              <label className={FIELD}>
                <span className={FIELD_LABEL}>Unrealized %</span>
                <input
                  type="number"
                  className={CONTROL}
                  value={unrealized}
                  onChange={(e) => setUnrealized(e.target.value)}
                  placeholder={FEE_DEFAULTS.unrealized}
                  min="0"
                  max="100"
                  step="0.01"
                />
              </label>
              <label className={FIELD}>
                <span className={FIELD_LABEL}>Affiliate %</span>
                <input
                  type="number"
                  className={CONTROL}
                  value={affiliate}
                  onChange={(e) => setAffiliate(e.target.value)}
                  placeholder={FEE_DEFAULTS.affiliate}
                  min="0"
                  max="100"
                  step="0.01"
                />
              </label>
            </div>
            <small className={FIELD_HINT}>
              Leave blank to use the standard rates ({FEE_DEFAULTS.realized}% of
              realized profit, {FEE_DEFAULTS.unrealized}% of unrealized).
            </small>
          </div>
        )}

        {error && (
          <p
            className="py-2.5 px-3.5 border border-[rgba(239,68,68,0.35)] rounded-field bg-[rgba(239,68,68,0.08)] text-[#ef4444] text-[13px]"
            role="alert"
          >
            {error}
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
            {saving ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  )
}
