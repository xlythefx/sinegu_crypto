import { Coins } from 'lucide-react'
import { CARD, CARD_HEAD, CARD_SUB, CARD_TITLE, STEP } from './classes'
import type { AdminAsset } from '../../../types/admin'

/** Card grid of the exchange's enabled assets — one tap selects the ticker. */
export default function TickerPicker({
  assets,
  value,
  onChange,
  exchangeLabel,
}: {
  assets: AdminAsset[]
  value: string
  onChange: (ticker: string) => void
  exchangeLabel: string
}) {
  return (
    <section className={CARD} data-aos="fade-up" data-aos-delay="60">
      <div className={CARD_HEAD}>
        <span className={STEP}>2</span>
        <div className="min-w-0">
          <div className={CARD_TITLE}>Asset</div>
          <div className={CARD_SUB}>
            Only enabled {exchangeLabel} assets can be traded — entries fail closed otherwise.
          </div>
        </div>
      </div>

      {assets.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-7 px-3 text-center">
          <Coins size={20} className="text-muted" />
          <p className="text-[13px] text-muted">
            No enabled {exchangeLabel} assets. Add one in{' '}
            <span className="font-bold text-text">Assets</span> first.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2.5">
          {assets.map((asset) => {
            const selected = value === asset.ticker
            return (
              <button
                key={asset.asset_id}
                type="button"
                onClick={() => onChange(selected ? '' : asset.ticker)}
                aria-pressed={selected}
                className={`flex flex-col items-center gap-1.5 rounded-[12px] border-2 p-3 text-center cursor-pointer transition-[border-color,background,transform] duration-150 active:scale-[0.97] ${
                  selected
                    ? 'border-accent bg-accent-soft'
                    : 'border-border bg-surface2 hover:border-accent-line'
                }`}
              >
                {asset.asset_image ? (
                  <img
                    src={asset.asset_image}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                    onError={(e) => {
                      ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
                    }}
                  />
                ) : (
                  <span className="grid place-items-center w-8 h-8 rounded-full bg-accent-soft border border-accent-line font-mono text-[12px] font-bold text-accent">
                    {asset.ticker.slice(0, 2)}
                  </span>
                )}
                <span
                  className={`font-mono text-[11.5px] font-bold leading-tight ${
                    selected ? 'text-accent' : 'text-text'
                  }`}
                >
                  {asset.ticker}
                </span>
                {asset.side !== 'ALL' && (
                  <span className="rounded-pill border border-border px-1.5 text-[10px] font-bold text-muted">
                    {asset.side} only
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
