import { Award } from 'lucide-react'
import { fmtNum } from '../../lib/format'

interface HighWaterMarkCardProps {
  value: number
}

/** High-Water Mark card — peak equity reached this period (gradient surface). */
export default function HighWaterMarkCard({ value }: HighWaterMarkCardProps) {
  return (
    <section
      className="rounded-card p-card border border-accent-line bg-[linear-gradient(160deg,var(--accentSoft),var(--surface))]"
      data-aos="fade-up"
      data-aos-delay="200"
    >
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border border-accent-line bg-accent-soft text-accent">
          <Award size={16} />
        </span>
        <div className="font-display text-[15px] font-extrabold">High-Water Mark</div>
      </div>
      <div className="font-mono text-[28px] font-extrabold tracking-[-0.6px] text-accent">
        ${fmtNum(value)}
      </div>
      <p className="mt-2 text-[11.5px] leading-normal text-muted">
        Peak equity reached this period. Fees apply only on new highs.
      </p>
    </section>
  )
}
