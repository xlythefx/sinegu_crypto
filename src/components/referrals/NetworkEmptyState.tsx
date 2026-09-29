import { useState } from 'react'
import { Users } from 'lucide-react'
import CopyState from '../ui/CopyState'

interface NetworkEmptyStateProps {
  /** Full invite link, or null when no referral code exists yet. */
  inviteLink: string | null
}

/**
 * Shown when the network has no members at all (distinct from the inline
 * "No members match your filters." message used for filtered-empty results).
 */
export default function NetworkEmptyState({ inviteLink }: NetworkEmptyStateProps) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    if (!inviteLink) return
    void navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="rounded-card border border-dashed border-border bg-surface flex flex-col items-center text-center py-12 px-6">
      <Users size={44} className="text-faint mb-3.5" />
      <h3 className="text-[17px] font-bold mb-1.5">Your network is empty</h3>
      <p className="text-[13px] text-muted max-w-[360px] leading-[1.55]">
        Share your invitation link to start referring traders.
      </p>
      {inviteLink ? (
        <button
          type="button"
          className="inline-flex items-center gap-2 mt-5 py-[10px] px-5 rounded-pill border-0 bg-accent text-on-accent text-[13px] font-bold cursor-pointer shadow-[0_10px_24px_var(--glow)] transition-[filter] duration-150 hover:brightness-[1.06]"
          onClick={copy}
        >
          <CopyState copied={copied} size={15} label="Copy invite link" copiedLabel="Link copied" />
        </button>
      ) : (
        <p className="text-[12.5px] text-faint mt-4">
          Generate your referral code above to get your invite link.
        </p>
      )}
    </div>
  )
}
