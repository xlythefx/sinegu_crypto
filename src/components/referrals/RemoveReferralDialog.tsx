import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import ConfirmModal from '../ui/ConfirmModal'
import { removeMember } from '../../services/referrals'
import { getApiErrorMessage } from '../../services/api'
import type { ReferralMember } from '../../types/referrals'

interface RemoveReferralDialogProps {
  /** null = closed. */
  member: ReferralMember | null
  onCancel: () => void
  /** Called after a successful removal — close + reload. */
  onRemoved: () => void
}

/**
 * ConfirmModal wrapper for removing a member from the referral network.
 * Manages its own in-flight state; errors surface inline while the modal
 * stays open so the action can be retried or cancelled.
 */
export default function RemoveReferralDialog({
  member,
  onCancel,
  onRemoved,
}: RemoveReferralDialogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    if (!member || busy) return
    setBusy(true)
    setError(null)
    try {
      await removeMember(member.userUniId)
      onRemoved()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not remove this member.'))
    } finally {
      setBusy(false)
    }
  }

  const handleCancel = () => {
    setError(null)
    onCancel()
  }

  return (
    <>
      <ConfirmModal
        open={member !== null}
        title="Remove from network?"
        message={
          member
            ? `This will remove ${member.name} from your referral network. This action cannot be undone.`
            : undefined
        }
        confirmLabel={busy ? 'Removing…' : 'Yes, remove'}
        cancelLabel="No"
        danger
        onConfirm={() => void handleConfirm()}
        onCancel={handleCancel}
      />
      {member && error && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1100] flex items-center gap-2 rounded-field border border-[rgba(255,90,90,0.45)] bg-surface py-2.5 px-4 text-[12.5px] font-semibold text-red shadow-[0_16px_40px_rgba(0,0,0,0.35)] max-w-[calc(100vw-48px)]"
          role="alert"
        >
          <AlertCircle size={15} className="flex-none" />
          <span>{error}</span>
        </div>
      )}
    </>
  )
}
