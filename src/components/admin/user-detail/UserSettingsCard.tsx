import { useEffect, useState } from 'react'
import { Ban, RotateCcw, Save, SlidersHorizontal } from 'lucide-react'
import ConfirmModal from '../../ui/ConfirmModal'
import { useSessionUser } from '../../../hooks/useSessionUser'
import { updateAdminUser } from '../../../services/admin'
import { getApiErrorMessage } from '../../../services/api'
import type { AdminUserDetail } from '../../../types/admin'

const FIELD =
  'h-10 rounded-field border border-border bg-surface2 px-3 font-mono text-[13px] text-text outline-none focus:border-accent-line'
const LABEL = 'flex flex-col gap-[6px] text-[12px] font-semibold text-muted'
const BTN =
  'inline-flex items-center gap-1.5 rounded-pill py-[9px] px-4 text-[12.5px] font-bold cursor-pointer transition disabled:opacity-[.55] disabled:cursor-not-allowed'

type PendingConfirm = 'save' | 'suspend' | 'reactivate' | null

interface UserSettingsCardProps {
  user: AdminUserDetail
  /** Called after a successful save / status change (reloads the page data). */
  onUpdated: () => void
}

/**
 * Admin-editable settings: the three fee percentages and (where allowed)
 * suspend / reactivate. Every mutation goes through ConfirmModal. The status
 * control is hidden for master accounts, pending users (the approval queue
 * owns those) and the admin's own account — mirroring the API guards.
 */
export default function UserSettingsCard({
  user,
  onUpdated,
}: UserSettingsCardProps) {
  const sessionUser = useSessionUser()

  const [realized, setRealized] = useState(String(user.realized_percentage))
  const [unrealized, setUnrealized] = useState(String(user.unrealized_percentage))
  const [affiliate, setAffiliate] = useState(String(user.affiliate_percentage))
  const [confirm, setConfirm] = useState<PendingConfirm>(null)
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Re-sync the inputs whenever fresh user data arrives (e.g. after a save)
  useEffect(() => {
    setRealized(String(user.realized_percentage))
    setUnrealized(String(user.unrealized_percentage))
    setAffiliate(String(user.affiliate_percentage))
  }, [user])

  const isMaster = user.type === 'master'
  const isPending = user.status === 'pending'
  const isSelf = sessionUser?.uni_id === user.uni_id
  const canToggleStatus = !isMaster && !isPending && !isSelf

  const statusHint = isMaster
    ? 'The master account cannot be suspended.'
    : isPending
      ? 'Pending accounts are managed from the approval queue.'
      : isSelf
        ? 'You cannot change your own account status.'
        : null

  const parsePct = (raw: string): number | null => {
    const n = Number(raw)
    if (raw.trim() === '' || Number.isNaN(n) || n < 0 || n > 100) return null
    return n
  }

  const requestSave = () => {
    setErrorMsg(null)
    if (
      parsePct(realized) === null ||
      parsePct(unrealized) === null ||
      parsePct(affiliate) === null
    ) {
      setErrorMsg('Each percentage must be a number between 0 and 100.')
      return
    }
    setConfirm('save')
  }

  const run = async (action: Exclude<PendingConfirm, null>) => {
    setBusy(true)
    setErrorMsg(null)
    try {
      if (action === 'save') {
        await updateAdminUser(user.uni_id, {
          realized_percentage: parsePct(realized)!,
          unrealized_percentage: parsePct(unrealized)!,
          affiliate_percentage: parsePct(affiliate)!,
        })
      } else {
        await updateAdminUser(user.uni_id, {
          status: action === 'suspend' ? 'suspended' : 'active',
        })
      }
      onUpdated()
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err, 'Unable to update this user.'))
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  const confirmCopy: Record<
    Exclude<PendingConfirm, null>,
    { title: string; message: string; label: string; danger: boolean }
  > = {
    save: {
      title: `Save fee settings for ${user.name || 'this user'}?`,
      message: `Realized ${realized}% · Unrealized ${unrealized}% · Affiliate ${affiliate}%. New fees apply from the next invoice.`,
      label: 'Yes, save',
      danger: false,
    },
    suspend: {
      title: `Suspend ${user.name || 'this user'}?`,
      message:
        'The account will be blocked from signing in until it is reactivated.',
      label: 'Yes, suspend',
      danger: true,
    },
    reactivate: {
      title: `Reactivate ${user.name || 'this user'}?`,
      message: 'The account becomes active and can sign in again.',
      label: 'Yes, reactivate',
      danger: false,
    },
  }

  return (
    <section className="rounded-card border border-border bg-surface p-card">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid h-7 w-7 flex-none place-items-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
          <SlidersHorizontal size={16} />
        </span>
        <div>
          <div className="font-display text-[15px] font-extrabold">
            User Settings
          </div>
          <div className="mt-px text-[12px] text-muted">
            Fee shares and account status
          </div>
        </div>
      </div>

      {errorMsg && (
        <p
          className="mb-3.5 rounded-[10px] border border-[color-mix(in_srgb,var(--red)_30%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] px-3 py-[9px] text-[12.5px] text-red"
          role="alert"
        >
          {errorMsg}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <label className={LABEL}>
          Realized fee %
          <input
            type="number"
            step={0.01}
            min={0}
            max={100}
            value={realized}
            onChange={(e) => setRealized(e.target.value)}
            className={FIELD}
          />
        </label>
        <label className={LABEL}>
          Unrealized fee %
          <input
            type="number"
            step={0.01}
            min={0}
            max={100}
            value={unrealized}
            onChange={(e) => setUnrealized(e.target.value)}
            className={FIELD}
          />
        </label>
        <label className={LABEL}>
          Affiliate commission %
          <input
            type="number"
            step={0.01}
            min={0}
            max={100}
            value={affiliate}
            onChange={(e) => setAffiliate(e.target.value)}
            className={FIELD}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-hair pt-4">
        <button
          type="button"
          className={`${BTN} bg-accent text-on-accent shadow-[0_8px_20px_var(--glow)] enabled:hover:brightness-[1.06]`}
          disabled={busy}
          onClick={requestSave}
        >
          <Save size={13} />
          Save changes
        </button>

        {canToggleStatus ? (
          user.status === 'suspended' ? (
            <button
              type="button"
              className={`${BTN} border border-[color-mix(in_srgb,var(--green)_40%,transparent)] bg-transparent text-green enabled:hover:bg-[color-mix(in_srgb,var(--green)_10%,transparent)]`}
              disabled={busy}
              onClick={() => setConfirm('reactivate')}
            >
              <RotateCcw size={13} />
              Reactivate account
            </button>
          ) : (
            <button
              type="button"
              className={`${BTN} border border-[color-mix(in_srgb,var(--red)_40%,transparent)] bg-transparent text-red enabled:hover:bg-[color-mix(in_srgb,var(--red)_10%,transparent)]`}
              disabled={busy}
              onClick={() => setConfirm('suspend')}
            >
              <Ban size={13} />
              Suspend account
            </button>
          )
        ) : (
          statusHint && (
            <span className="text-[12px] text-faint">{statusHint}</span>
          )
        )}
      </div>

      {confirm && (
        <ConfirmModal
          open
          title={confirmCopy[confirm].title}
          message={confirmCopy[confirm].message}
          confirmLabel={busy ? 'Working…' : confirmCopy[confirm].label}
          cancelLabel="No"
          danger={confirmCopy[confirm].danger}
          onConfirm={() => !busy && run(confirm)}
          onCancel={() => !busy && setConfirm(null)}
        />
      )}
    </section>
  )
}
