import { Segmented } from './filters'

type CellUnit = 'usd' | 'pct'

const UNIT_OPTIONS = [
  { value: 'usd' as const, label: '$' },
  { value: 'pct' as const, label: '%' },
]

interface CalendarUnitSwitchProps {
  showPct: boolean
  onChange: (showPct: boolean) => void
}

/** The $ / % switch in a Daily P&L Calendar's header (see useCalendarUnit). */
export default function CalendarUnitSwitch({ showPct, onChange }: CalendarUnitSwitchProps) {
  return (
    <Segmented<CellUnit>
      size="sm"
      ariaLabel="Show each day in dollars or percent"
      value={showPct ? 'pct' : 'usd'}
      onChange={(unit) => onChange(unit === 'pct')}
      options={UNIT_OPTIONS}
    />
  )
}
