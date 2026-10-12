import { useState } from 'react'
import CopyState from '../ui/CopyState'
import { BINANCE_REFERRAL_CODE } from '../../lib/binanceOffer'

/**
 * The code itself, copyable — for the reader whose sign-up screen did not
 * fill it in (an app install that dropped the link, a browser that stripped
 * the query). Typing it into Binance's Referral ID box does the same job.
 */
export default function ReferralCodeChip() {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(BINANCE_REFERRAL_CODE)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the code is selectable in place */
    }
  }

  return (
    <div className="inline-flex max-w-full items-center gap-3 rounded-pill border border-border bg-surface py-1.5 pl-4 pr-1.5">
      <span className="font-mono text-[11px] uppercase tracking-widest text-faint">
        Referral ID
      </span>
      <code className="font-mono text-[15px] font-bold tracking-[0.06em] text-text">
        {BINANCE_REFERRAL_CODE}
      </code>
      <button
        type="button"
        onClick={copy}
        className="inline-flex flex-none items-center gap-1.5 rounded-pill border border-border bg-surface2 px-3 py-1.5 text-[12px] font-bold text-text transition-colors hover:border-accent"
      >
        <CopyState copied={copied} />
      </button>
    </div>
  )
}
