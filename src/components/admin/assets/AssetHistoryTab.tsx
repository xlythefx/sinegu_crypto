import { History } from 'lucide-react'
import AssetHistoryList from './AssetHistoryList'
import { EXCHANGE_META } from '../../exchanges/meta'
import type { ExchangeFilter } from './exchangeGroups'

/**
 * Admin → Trading Assets → Change history: every change to any coin's
 * settings, newest first, narrowed by the page's exchange switcher. Who
 * changed RENDER's size, and when, is one look instead of an investigation.
 */
export default function AssetHistoryTab({ exchange }: { exchange: ExchangeFilter }) {
  const broker = exchange === 'all' ? undefined : EXCHANGE_META[exchange].label
  return (
    <div className="flex flex-col gap-stack">
      <section
        className="flex items-start gap-3 rounded-card border border-border bg-surface p-card"
        data-aos="fade-up"
      >
        <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-accent-soft text-accent">
          <History size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-extrabold">
            {broker ? `${broker} change history` : 'Change history'}
          </h2>
          <p className="mt-0.5 text-[12.5px] leading-[1.55] text-muted">
            Every change to a coin's settings — size, max position, streak steps, kill switch,
            on/off — with who made it and what it was before. Automatic changes are listed too: a
            waiting size going live after a close, and the kill switch.
          </p>
        </div>
      </section>

      {/* Re-keyed on the exchange so a switch replays the reveal (project convention). */}
      <section
        key={exchange}
        className="rounded-card border border-border bg-surface p-card animate-[fadeup_0.35s_ease-out]"
      >
        <AssetHistoryList broker={broker} />
      </section>
    </div>
  )
}
