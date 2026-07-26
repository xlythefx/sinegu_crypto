import { Coins, TrendingUp, Wallet } from 'lucide-react'
import { fmtPctOf, fmtSignedMoney } from '../../lib/format'

interface PnlOverviewProps {
  realized: number
  unrealized: number
  total: number
  /** Base for the % chips (net deposits). */
  pctBase: number
}

/** The 3 PNL tiles: Realized / Unrealized / Total, each with a % chip. */
export default function PnlOverview({
  realized,
  unrealized,
  total,
  pctBase,
}: PnlOverviewProps) {
  const tiles = [
    {
      label: 'REALIZED PNL',
      value: realized,
      hint: 'From closed positions',
      icon: Coins,
    },
    {
      label: 'UNREALIZED PNL',
      value: unrealized,
      hint: 'From open positions',
      icon: TrendingUp,
    },
    {
      label: 'TOTAL PNL',
      value: total,
      hint: 'Realized + Unrealized',
      icon: Wallet,
    },
  ]

  return (
    <div
      className="grid grid-cols-3 gap-3 mb-4 max-[900px]:grid-cols-1"
      data-aos="fade-up"
    >
      {tiles.map((t) => {
        const negative = t.value < 0
        return (
          <div
            className="rounded-card border border-border bg-surface flex items-start justify-between gap-2 p-4"
            key={t.label}
          >
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[10.5px] font-bold tracking-[0.06em] text-faint">
                {t.label}
              </span>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span
                  className={`text-[22px] font-extrabold font-mono ${negative ? 'text-red' : 'text-green'}`}
                >
                  {fmtSignedMoney(t.value)}
                </span>
                <span
                  className={`text-[11.5px] font-bold py-0.5 px-1.5 rounded-md font-mono ${
                    negative
                      ? 'bg-[rgba(255,90,90,0.1)] text-red'
                      : 'bg-[rgba(47,214,122,0.1)] text-green'
                  }`}
                >
                  {fmtPctOf(t.value, pctBase, 2)}
                </span>
              </div>
              <span className="text-[11.5px] text-muted">{t.hint}</span>
            </div>
            <span className="w-7 h-7 rounded-[9px] bg-accent-soft border border-accent-line flex items-center justify-center text-accent flex-none">
              <t.icon size={16} />
            </span>
          </div>
        )
      })}
    </div>
  )
}
