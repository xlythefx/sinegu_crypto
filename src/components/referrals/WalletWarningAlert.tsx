import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, X } from 'lucide-react'

/**
 * Dismissible banner shown when the user has zero payout methods on file.
 * Visibility (zero methods) is decided by the parent; dismissal is local.
 */
export default function WalletWarningAlert() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div
      className="flex items-start gap-3 rounded-card border border-accent-line bg-accent-soft p-4 mb-4"
      role="alert"
      data-aos="fade-up"
    >
      <AlertTriangle size={18} className="text-accent flex-none mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-bold text-text">
          Add a payout method to receive your earnings
        </p>
        <p className="text-[12.5px] text-muted mt-0.5 leading-[1.5]">
          Referral commissions are released to your USDT (TRC20) wallet or bank
          account — add one so your payouts are never delayed.
        </p>
        <Link
          to="/dashboard/settings"
          className="inline-flex items-center gap-1 mt-2 text-[12.5px] font-bold text-accent hover:underline"
        >
          Open settings →
        </Link>
      </div>
      <button
        type="button"
        className="inline-flex items-center justify-center w-7 h-7 rounded-btn bg-transparent text-muted cursor-pointer flex-none transition-[background,color] duration-150 hover:text-text hover:bg-surface2"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
      >
        <X size={15} />
      </button>
    </div>
  )
}
