/**
 * The Performance Analytics page's outline while its first payload loads —
 * the same grid the real cards land in, so nothing jumps when they arrive.
 */
const CARD = 'rounded-card border border-border bg-surface p-card'
const BAR = 'rounded-[6px] bg-surface2 animate-pulse'

function CardSkeleton({ height, lines = 2 }: { height: string; lines?: number }) {
  return (
    <div className={`${CARD} flex flex-col gap-3`} style={{ minHeight: height }}>
      <div className="flex items-center gap-2.5">
        <span className={`${BAR} h-7 w-7`} />
        <div className="flex flex-col gap-1.5">
          <span className={`${BAR} h-3.5 w-36`} />
          <span className={`${BAR} h-2.5 w-52 max-w-full`} />
        </div>
      </div>
      <span className={`${BAR} flex-1 min-h-[60px] mt-1`} />
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className={`${BAR} h-2.5`} style={{ width: `${70 - i * 18}%` }} />
      ))}
    </div>
  )
}

export default function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-stack" aria-busy="true" aria-label="Loading analytics">
      <div className="grid grid-cols-5 gap-stack max-[1200px]:grid-cols-3 max-[720px]:grid-cols-2 max-[420px]:grid-cols-1">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={`${CARD} flex flex-col gap-3 min-h-[150px]`}>
            <span className={`${BAR} h-2.5 w-24`} />
            <span className={`${BAR} h-7 w-28 mt-2`} />
            <span className={`${BAR} h-2.5 w-36 max-w-full`} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[1.25fr_1fr] gap-stack max-[1100px]:grid-cols-1">
        <CardSkeleton height="380px" />
        <CardSkeleton height="380px" lines={3} />
      </div>
      <CardSkeleton height="220px" />
      <CardSkeleton height="220px" />
    </div>
  )
}
