import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, RotateCcw, Trash2 } from 'lucide-react'
import ConfirmModal from '../../ui/ConfirmModal'
import { useSessionUser } from '../../../hooks/useSessionUser'
import { deleteAdminUser, refreshAdminUser, updateAdminUser } from '../../../services/admin'
import { getApiErrorMessage } from '../../../services/api'
import type { AdminUserDetail } from '../../../types/admin'

const BTN =
  'inline-flex items-center gap-1.5 h-9 rounded-pill px-4 text-[12.5px] font-bold cursor-pointer transition disabled:opacity-[.55] disabled:cursor-not-allowed'

type Pending = 'reactivate' | 'delete' | null

interface UserHeaderActionsProps {
  user: AdminUserDetail
  /** Re-read every figure on the page (after a refresh or a status change). */
  onChanged: () => void
}

/**
 * The actions on the "Back to Users" row, far right: Refresh (reads the
 * user's exchange accounts NOW, then the page re-reads) and, for a suspended
 * user, Reactivate + Delete — kept up here so they are not buried under the
 * settings card at the bottom of the page. Admin only; the page does not
 * render this for a read-only collaborator.
 */
export default function UserHeaderActions({ user, onChanged }: UserHeaderActionsProps) {
  const navigate = useNavigate()
  const sessionUser = useSessionUser()
  const [pending, setPending] = useState<Pending>(null)
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null)

  const name = user.name || 'this user'
  const suspended = user.status === 'suspended'
  const canChangeStatus = suspended && user.type !== 'master' && sessionUser?.uni_id !== user.uni_id
  const blockers = user.delete_blockers ?? []

  const refresh = async () => {
    setRefreshing(true)
    setNote(null)
    try {
      setNote({ text: await refreshAdminUser(user.uni_id), error: false })
    } catch (err) {
      setNote({ text: getApiErrorMessage(err, 'Could not refresh from the exchange.'), error: true })
    } finally {
      setRefreshing(false)
      onChanged()
    }
  }

  const run = async () => {
    if (!pending) return
    setBusy(true)
    setNote(null)
    try {
      if (pending === 'delete') {
        await deleteAdminUser(user.uni_id)
        navigate('/admin/users', { replace: true })
        return
      }
      await updateAdminUser(user.uni_id, { status: 'active' })
      onChanged()
    } catch (err) {
      setNote({ text: getApiErrorMessage(err, 'Unable to update this user.'), error: true })
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          className={`${BTN} border border-accent-line bg-accent-soft text-accent enabled:hover:bg-accent enabled:hover:text-on-accent`}
          onClick={refresh}
          disabled={refreshing}
          title="Read this user's balance and open positions from the exchange now"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>

        {canChangeStatus && (
          <>
            <button
              type="button"
              className={`${BTN} bg-green text-bg shadow-[0_6px_18px_color-mix(in_srgb,var(--green)_30%,transparent)] enabled:hover:brightness-[1.08]`}
              onClick={() => setPending('reactivate')}
              disabled={busy}
            >
              <RotateCcw size={14} />
              Reactivate account
            </button>
            <button
              type="button"
              className={`${BTN} border border-[color-mix(in_srgb,var(--red)_45%,transparent)] bg-transparent text-red enabled:hover:bg-[color-mix(in_srgb,var(--red)_10%,transparent)]`}
              onClick={() => setPending('delete')}
              disabled={busy || blockers.length > 0}
              title={blockers.length > 0 ? blockers.join('\n') : undefined}
            >
              <Trash2 size={14} />
              Delete account
            </button>
          </>
        )}
      </div>

      {canChangeStatus && blockers.length > 0 && (
        <p className="max-w-[420px] text-right text-[11.5px] text-faint">
          Can&apos;t delete: {blockers.join(' ')}
        </p>
      )}
      {note && (
        <p className={`max-w-[420px] text-right text-[12px] ${note.error ? 'text-red' : 'text-muted'}`} role="status">
          {note.text}
        </p>
      )}

      {pending && (
        <ConfirmModal
          open
          title={pending === 'delete' ? `Delete ${name}?` : `Reactivate ${name}?`}
          message={
            pending === 'delete'
              ? `This permanently removes ${name}'s sign-in and profile (${user.email}). It cannot be undone.`
              : 'The account becomes active and can sign in again.'
          }
          confirmLabel={busy ? 'Working…' : pending === 'delete' ? 'Yes, delete' : 'Yes, reactivate'}
          cancelLabel="No"
          danger={pending === 'delete'}
          onConfirm={() => !busy && run()}
          onCancel={() => !busy && setPending(null)}
        />
      )}
    </div>
  )
}
