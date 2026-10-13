import { useState } from 'react'
import { Hourglass } from 'lucide-react'
import ConfirmModal from '../../ui/ConfirmModal'
import { applyPendingSizing, cancelPendingSizing } from '../../../services/admin'
import { getApiErrorMessage } from '../../../services/api'
import { displaySymbol } from '../../../lib/chart'
import { fmtDateTime } from '../../../lib/format'
import { holderText, pendingChangeLines } from '../../../lib/assetSizing'
import { fmtSize } from '../../../lib/streakSizing'
import type { AdminAsset } from '../../../types/admin'

const BTN =
  'inline-flex h-8 flex-none items-center justify-center rounded-pill border px-3.5 text-[12px] font-bold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50'

interface PendingSizingStripProps {
  asset: AdminAsset
  /** The asset after "Apply now" / "Cancel" — the caller re-reads or swaps it in. */
  onChanged: (asset: AdminAsset) => void
  busy?: boolean
}

/**
 * "New size waiting" on a coin card: a size change saved while the main
 * account held the coin, waiting for that position to close (API
 * PendingSizing) — what changes, what it waits for, who saved it, and the two
 * ways out: Apply now (an emergency, confirmed) or Cancel.
 *
 * Laid out against its own width like KilledAssetStrip: the same strip sits
 * in a ~300px asset tile and in a half-width streak card.
 */
export default function PendingSizingStrip({ asset, onChanged, busy = false }: PendingSizingStripProps) {
  const [confirm, setConfirm] = useState<'apply' | 'cancel' | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = asset.pending_sizing
  if (!pending) return null

  const symbol = displaySymbol(asset.ticker)
  const lines = pendingChangeLines(asset)
  const waits = pending.waits_for
    ? `Goes live when ${holderText(asset.ticker, pending.waits_for)} closes.`
    : 'The position it waited for has closed — it goes live within a minute.'
  const saved = [
    pending.by_name ? `Saved by ${pending.by_name}` : 'Saved',
    pending.since ? fmtDateTime(pending.since) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const run = async () => {
    if (!confirm) return
    setWorking(true)
    setError(null)
    try {
      const updated =
        confirm === 'apply'
          ? await applyPendingSizing(asset.asset_id)
          : await cancelPendingSizing(asset.asset_id)
      setConfirm(null)
      onChanged(updated)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not change the waiting size.'))
      setConfirm(null)
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="@container">
      <div className="flex flex-col gap-2.5 rounded-row border border-accent-line bg-accent-soft px-3.5 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-8 w-8 flex-none place-items-center rounded-[10px] bg-accent text-on-accent">
            <Hourglass size={15} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold leading-snug text-accent">New size waiting</p>
            {lines.length > 0 && (
              <ul className="mt-1 flex flex-col gap-0.5">
                {lines.map((line) => (
                  <li key={line} className="font-mono text-[11.5px] leading-[1.45] text-text">
                    {line}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1.5 text-[12px] leading-[1.5] text-muted">{waits}</p>
            <p className="mt-0.5 text-[11px] leading-[1.45] text-faint">{saved}</p>
          </div>
        </div>
        <div className="ml-11 flex flex-wrap gap-2">
          <button
            type="button"
            className={`${BTN} border-accent bg-surface text-accent hover:bg-accent hover:text-on-accent`}
            onClick={() => setConfirm('apply')}
            disabled={busy || working}
          >
            Apply now
          </button>
          <button
            type="button"
            className={`${BTN} border-border bg-surface text-text hover:border-accent`}
            onClick={() => setConfirm('cancel')}
            disabled={busy || working}
          >
            Cancel change
          </button>
        </div>
        {error && (
          <p className="ml-11 text-[12px] text-red" role="alert">
            {error}
          </p>
        )}
      </div>

      <ConfirmModal
        open={confirm === 'apply'}
        title={`Apply the new ${symbol} size now?`}
        message={`${lines.join(' · ')}. The open position is then measured in the new size: a bigger size lets the stack grow past what you intended, a smaller one makes it look full sooner. Waiting for the close avoids both.`}
        confirmLabel={working ? 'Applying…' : 'Yes, apply now'}
        cancelLabel="No, keep waiting"
        danger
        onConfirm={() => !working && run()}
        onCancel={() => !working && setConfirm(null)}
      />
      <ConfirmModal
        open={confirm === 'cancel'}
        title={`Drop the waiting ${symbol} size?`}
        message={`${symbol} keeps trading at base ${fmtSize(asset.base_size)} / max ${fmtSize(asset.max_increments)}${
          asset.streak_sizes.length ? ` with its current streak steps` : ''
        }. You can save the new size again later.`}
        confirmLabel={working ? 'Dropping…' : 'Yes, drop it'}
        cancelLabel="No"
        onConfirm={() => !working && run()}
        onCancel={() => !working && setConfirm(null)}
      />
    </div>
  )
}
