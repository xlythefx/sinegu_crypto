import { Power } from 'lucide-react'
import EditorSection from './EditorSection'
import { fmtDateTime } from '../../../../lib/format'
import { isKilled } from '../../../../lib/killSwitch'
import type { AssetDraft } from '../../../../lib/assetDraft'
import type { AdminAsset } from '../../../../types/admin'

interface TradingSectionProps {
  draft: AssetDraft
  update: (patch: Partial<AssetDraft>) => void
  asset: AdminAsset | null
}

/** Section 3 — whether the bot may open trades on this coin at all. */
export default function TradingSection({ draft, update, asset }: TradingSectionProps) {
  const killed = asset !== null && isKilled(asset)
  const on = draft.enabled

  return (
    <EditorSection
      id="asset-trading"
      Icon={Power}
      title="Trading"
      description="Off stops new entries on this coin. Open positions still close on their exit signal."
    >
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => update({ enabled: !on })}
        className={`flex min-h-14 w-full cursor-pointer items-center gap-3.5 rounded-row border px-4 py-3 text-left transition-[border-color,background] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          on ? 'border-accent-line bg-accent-soft' : 'border-border bg-surface2 hover:border-accent'
        }`}
      >
        <span
          className={`relative inline-block h-6 w-11 flex-none rounded-pill border transition-[background,border-color] duration-150 ${
            on ? 'border-accent bg-accent' : 'border-border bg-surface'
          }`}
          aria-hidden="true"
        >
          <span
            className={`absolute top-[3px] left-[3px] h-4 w-4 rounded-full transition-transform duration-150 ${
              on ? 'translate-x-5 bg-on-accent' : 'bg-muted'
            }`}
          />
        </span>
        <span className="min-w-0">
          <span className={`block text-[14px] font-bold ${on ? 'text-green' : 'text-muted'}`}>
            {on ? 'Trading on' : 'Trading off'}
          </span>
          <span className="block text-[12px] leading-[1.45] text-faint">
            {on ? 'Signals for this coin open trades.' : 'Entry signals for this coin are refused.'}
          </span>
        </span>
      </button>

      {/* Switching a killed coin on is the "turn back on". */}
      {killed && (
        <p className="rounded-row border border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-[color-mix(in_srgb,var(--red)_8%,transparent)] px-3.5 py-2.5 text-[12.5px] leading-[1.55] text-red">
          Switched off by the kill switch{asset?.killed_at ? ` on ${fmtDateTime(asset.killed_at)}` : ''}.{' '}
          {on ? 'Saving' : 'Switching it on'} turns it back on, and the master&rsquo;s losses are counted again from
          then.
        </p>
      )}
    </EditorSection>
  )
}
