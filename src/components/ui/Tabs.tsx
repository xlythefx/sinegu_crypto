import type { LucideIcon } from 'lucide-react'

export interface TabItem<K extends string> {
  key: K
  label: string
  Icon?: LucideIcon
  /** Small count beside the label (e.g. items needing attention); hidden at 0. */
  badge?: number
}

interface TabsProps<K extends string> {
  tabs: TabItem<K>[]
  active: K
  onChange: (key: K) => void
  label: string
}

const TAB_BTN =
  'inline-flex flex-none items-center gap-1.5 whitespace-nowrap text-[12.5px] font-semibold py-[7px] px-4 rounded-btn cursor-pointer transition-colors duration-150'

/**
 * Segmented tab bar (the pill pattern from Admin → User Details). Scrolls
 * sideways on a phone rather than wrapping, so the row keeps one height and
 * the content below never jumps as tabs are added.
 */
export default function Tabs<K extends string>({
  tabs,
  active,
  onChange,
  label,
}: TabsProps<K>) {
  return (
    <div className="max-w-full overflow-x-auto [scrollbar-width:none]">
      <div
        className="inline-flex gap-1 rounded-[12px] border border-border bg-surface p-1"
        role="tablist"
        aria-label={label}
      >
        {tabs.map(({ key, label: text, Icon, badge }) => {
          const on = key === active
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={on}
              className={`${TAB_BTN} ${
                on
                  ? 'bg-accent text-on-accent'
                  : 'bg-transparent text-muted hover:text-text'
              }`}
              onClick={() => onChange(key)}
            >
              {Icon && <Icon size={13} />}
              {text}
              {!!badge && (
                <span
                  className={`min-w-[18px] rounded-pill px-1.5 text-center font-mono text-[10.5px] font-bold leading-[18px] ${
                    on ? 'bg-on-accent/20' : 'bg-red/15 text-red'
                  }`}
                >
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
