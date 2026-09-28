import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, UserPlus, X } from 'lucide-react'
import ConfirmModal from '../../ui/ConfirmModal'
import { InsightCard } from './parts'
import { acceptUser, rejectUser } from '../../../services/admin'
import { getApiErrorMessage } from '../../../services/api'
import { fmtDateTime } from '../../../lib/format'
import type { OverviewInsights } from '../../../types/adminInsights'

type Pending = OverviewInsights['attention']['pending_users'][number]

interface PendingAction {
  user: Pending
  action: 'accept' | 'reject'
}

const BTN =
  'inline-flex items-center gap-1 rounded-pill border px-3 py-1.5 text-[12px] font-bold transition-colors cursor-pointer disabled:cursor-default disabled:opacity-50'

/**
 * Overview → Needs attention: sign-ups waiting for a human, approvable right
 * here. The API sends the first 10; the rest are one click away on User
 * Management. `readOnly` (collaborator) lists them without the buttons.
 */
export default function PendingApprovalsCard({
  users,
  count,
  readOnly,
  onResolved,
}: {
  users: Pending[]
  count: number
  readOnly: boolean
  onResolved: () => void
}) {
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    if (!pending) return
    setBusy(true)
    setError(null)
    try {
      if (pending.action === 'accept') await acceptUser(pending.user.uni_id)
      else await rejectUser(pending.user.uni_id)
      onResolved()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to update user.'))
    } finally {
      setPending(null)
      setBusy(false)
    }
  }

  const more = count - users.length

  return (
    <InsightCard
      icon={UserPlus}
      title="Waiting for approval"
      subtitle={`${count} new sign-up${count === 1 ? '' : 's'} cannot use the app until approved`}
      link={{ to: '/admin/users', label: 'User Management' }}
    >
      {error && (
        <div className="mb-3 rounded-row border border-red/30 bg-red/10 px-4 py-2.5 text-[12.5px] text-red">
          {error}
        </div>
      )}
      <ul className="flex flex-col divide-y divide-hair">
        {users.map((u) => (
          <li
            key={u.uni_id}
            className="flex items-center justify-between gap-3 py-2.5 max-[520px]:flex-col max-[520px]:items-stretch"
          >
            <Link to={`/admin/users/${u.uni_id}`} className="min-w-0 hover:text-accent">
              <span className="block truncate text-[13.5px] font-semibold">{u.name}</span>
              <span className="block truncate text-[12px] text-muted">
                {u.email}
                {u.created_at ? ` · signed up ${fmtDateTime(u.created_at)}` : ''}
              </span>
            </Link>
            {!readOnly && (
              <span className="flex flex-none gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className={`${BTN} border-border bg-surface2 text-muted hover:border-red/40 hover:text-red`}
                  onClick={() => setPending({ user: u, action: 'reject' })}
                >
                  <X size={13} /> Reject
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className={`${BTN} border-accent-line bg-accent-soft text-accent hover:bg-accent hover:text-on-accent`}
                  onClick={() => setPending({ user: u, action: 'accept' })}
                >
                  <Check size={13} /> Approve
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {more > 0 && (
        <Link
          to="/admin/users"
          className="mt-2 block text-[12.5px] font-semibold text-accent hover:underline"
        >
          {more} more in User Management
        </Link>
      )}

      <ConfirmModal
        open={pending !== null}
        title={
          pending?.action === 'accept'
            ? `Approve ${pending?.user.name ?? 'user'}?`
            : `Reject ${pending?.user.name ?? 'user'}?`
        }
        message={
          pending?.action === 'accept'
            ? 'The account becomes active and can connect an exchange to start trading. They are emailed that they were approved.'
            : 'The account will be suspended and blocked from signing in.'
        }
        confirmLabel={busy ? 'Working…' : pending?.action === 'accept' ? 'Yes, approve' : 'Yes, reject'}
        cancelLabel="No"
        danger={pending?.action === 'reject'}
        onConfirm={run}
        onCancel={() => setPending(null)}
      />
    </InsightCard>
  )
}
