import { fmtSignedMoney } from '../../lib/format'

/**
 * The hover readout over a bar chart drawn BEFORE exchange fees: the bar's
 * figure, the fees, and what was left. Positioned by the bar's horizontal
 * fraction of the plot; flips to the other side of the cursor near an edge.
 * Rendered by the parent inside a `relative` wrapper around its <svg>.
 */
export default function BarReadout({
  xFrac,
  title,
  gross,
  net,
}: {
  xFrac: number
  title: string
  gross: number
  net: number
}) {
  const fees = gross - net
  return (
    <div
      className="pointer-events-none absolute top-2 z-10 rounded-card border border-border bg-surface2/97 px-3 py-2 backdrop-blur-sm animate-[fadeup_0.18s_ease-out]"
      style={{
        left: `${xFrac * 100}%`,
        transform: `translateX(${xFrac > 0.7 ? 'calc(-100% - 10px)' : xFrac < 0.3 ? '10px' : '-50%'})`,
      }}
    >
      <div className="font-mono text-[10.5px] tracking-[0.4px] text-faint whitespace-nowrap">
        {title}
      </div>
      <div className="mt-1 flex flex-col gap-1 font-mono text-[11.5px] whitespace-nowrap">
        <div className="flex justify-between gap-5">
          <span className="text-muted">Before fees</span>
          <span className={`font-extrabold ${gross < 0 ? 'text-red' : 'text-green'}`}>
            {fmtSignedMoney(gross)}
          </span>
        </div>
        <div className="flex justify-between gap-5">
          <span className="text-muted">Exchange fees</span>
          <span className="font-bold">{fees === 0 ? '$0.00' : fmtSignedMoney(-fees)}</span>
        </div>
        <div className="flex justify-between gap-5 border-t border-hair pt-1">
          <span className="text-muted">After fees</span>
          <span className={`font-extrabold ${net < 0 ? 'text-red' : 'text-green'}`}>
            {fmtSignedMoney(net)}
          </span>
        </div>
      </div>
    </div>
  )
}
