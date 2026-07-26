import type { LucideIcon } from 'lucide-react'
import { Info } from 'lucide-react'

export type Tone = 'pos' | 'neg' | 'accent' | ''

const toneText: Record<Tone, string> = {
  pos: 'text-green',
  neg: 'text-red',
  accent: 'text-accent',
  '': '',
}

interface MetricTileProps {
  label: string
  value: string
  tone?: Tone
  sub?: string
  subTone?: Tone
  icon?: LucideIcon
  iconTone?: Tone
  tooltip?: string
}

/** Small stat tile used across the analytics metric cards:
 *  optional icon + uppercase label (+ info tooltip), bold value, muted sub. */
export default function MetricTile({
  label,
  value,
  tone = '',
  sub,
  subTone = '',
  icon: Icon,
  iconTone = 'accent',
  tooltip,
}: MetricTileProps) {
  return (
    <div className="bg-surface2 border border-hair rounded-row py-[13px] px-[14px] flex flex-col gap-[5px]">
      <div className="flex items-center gap-1.5 min-w-0">
        {Icon && (
          <span
            className={`flex items-center flex-none ${toneText[iconTone] || 'text-accent'}`}
          >
            <Icon size={13} strokeWidth={2.5} />
          </span>
        )}
        <span className="text-[10px] font-extrabold tracking-[0.5px] text-faint uppercase min-w-0">
          {label}
        </span>
        {tooltip && (
          <span
            className="ml-auto text-faint flex items-center cursor-help flex-none hover:text-muted"
            title={tooltip}
          >
            <Info size={12} />
          </span>
        )}
      </div>
      <div
        className={`font-mono text-[17px] font-extrabold tracking-[-0.2px]${tone ? ` ${toneText[tone]}` : ''}`}
      >
        {value}
      </div>
      {sub && (
        <div
          className={`text-[11px] font-semibold ${subTone ? toneText[subTone] : 'text-muted'}`}
        >
          {sub}
        </div>
      )}
    </div>
  )
}
