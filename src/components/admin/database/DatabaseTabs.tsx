import { ListTree, Table2, Terminal } from 'lucide-react'
import { CARD, CHIP_BASE, CHIP_OFF, CHIP_ON } from './classes'

export type DatabaseTab = 'browse' | 'structure' | 'sql'

interface DatabaseTabsProps {
  active: DatabaseTab
  onChange: (tab: DatabaseTab) => void
}

const TABS = [
  { key: 'browse' as const, label: 'Browse', Icon: Table2 },
  { key: 'structure' as const, label: 'Structure', Icon: ListTree },
  { key: 'sql' as const, label: 'SQL', Icon: Terminal },
]

export default function DatabaseTabs({ active, onChange }: DatabaseTabsProps) {
  return (
    <div className={`${CARD} py-3`} role="tablist" aria-label="Database views">
      <div className="flex flex-wrap gap-2">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active === key}
            className={`${CHIP_BASE} ${active === key ? CHIP_ON : CHIP_OFF}`}
            onClick={() => onChange(key)}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
