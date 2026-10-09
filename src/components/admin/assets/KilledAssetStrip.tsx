import { Power } from 'lucide-react'
import { fmtDateTime } from '../../../lib/format'
import { killedFallbackReason } from '../../../lib/killSwitch'
import type { AdminAsset } from '../../../types/admin'

interface KilledAssetStripProps {
  asset: AdminAsset
  /** Opens the caller's confirmation — this strip never turns anything on by itself. */
  onTurnBackOn: () => void
  busy?: boolean
}

/**
 * "Switched off by the kill switch · {why} · {when}" with a Turn back on
 * button, on a killed asset's card (Assets tab and Streak Sizing Settings).
 *
 * Laid out against its own width (container query), not the viewport: the
 * same strip sits in a ~300px asset tile and in a half-width desktop card.
 * Narrow, the button drops under the text; from 448px it sits beside it.
 */
export default function KilledAssetStrip({ asset, onTurnBackOn, busy = false }: KilledAssetStripProps) {
  const reason = asset.killed_reason ?? killedFallbackReason(asset.kill_switch_losses)
  const when = asset.killed_at ? fmtDateTime(asset.killed_at) : null

  return (
    <div className="@container">
      <div className="flex flex-col gap-2.5 rounded-row border border-[color-mix(in_srgb,var(--red)_45%,transparent)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)] px-3.5 py-3 @md:flex-row @md:items-center @md:gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="grid h-8 w-8 flex-none place-items-center rounded-[10px] bg-red text-white">
            <Power size={15} aria-hidden="true" />
          </span>
          <p className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold leading-snug text-red">
              Switched off by the kill switch
            </span>
            <span className="mt-0.5 block text-[12px] leading-[1.5] text-muted">
              {reason}
              {when && <span className="whitespace-nowrap text-faint"> · {when}</span>}
            </span>
          </p>
        </div>
        <button
          type="button"
          className="ml-11 inline-flex h-9 flex-none items-center justify-center gap-1.5 self-start rounded-pill border border-[color-mix(in_srgb,var(--red)_45%,transparent)] bg-surface px-4 text-[12.5px] font-bold text-red transition-colors duration-150 hover:border-red hover:bg-red hover:text-white disabled:cursor-not-allowed disabled:opacity-50 @md:ml-0 @md:self-auto"
          onClick={onTurnBackOn}
          disabled={busy}
        >
          <Power size={13} aria-hidden="true" />
          Turn back on
        </button>
      </div>
    </div>
  )
}
