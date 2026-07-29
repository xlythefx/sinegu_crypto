import { useCountUp } from '../../hooks/useCountUp'

interface Stat {
  target: number
  prefix?: string
  suffix?: string
  decimals?: number
  label: string
}

const STATS: Stat[] = [
  { target: 4.2, prefix: '$', suffix: 'M+', decimals: 1, label: 'Volume traded' },
  { target: 18400, suffix: '+', label: 'Positions closed' },
  { target: 72, suffix: '%', label: 'Avg win rate' },
  { target: 3, label: 'Exchanges supported' },
]

function StatCard({ stat, index }: { stat: Stat; index: number }) {
  const { ref, value } = useCountUp(stat.target)
  const display = value.toLocaleString('en-US', {
    minimumFractionDigits: stat.decimals ?? 0,
    maximumFractionDigits: stat.decimals ?? 0,
  })

  return (
    <div
      ref={ref}
      data-aos="fade-up"
      data-aos-delay={index * 80}
      className="relative rounded-card border border-border bg-gradient-to-b from-surface to-surface2 p-6 overflow-hidden"
    >
      <span className="absolute right-4 top-4 flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-50" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
      </span>
      <div className="font-display text-4xl font-extrabold tracking-tight tabular-nums">
        {stat.prefix}
        {display}
        {stat.suffix}
      </div>
      <div className="mt-2 text-[13.5px] font-medium text-muted">{stat.label}</div>
    </div>
  )
}

export default function Metrics() {
  return (
    <section id="performance" className="relative py-16 md:py-20">
      <div className="max-w-[1200px] mx-auto px-6 max-[560px]:px-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map((s, i) => (
            <StatCard key={s.label} stat={s} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
