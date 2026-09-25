import { useEffect, useRef, useState } from 'react'
import { CalendarRange, ChevronDown } from 'lucide-react'
import type { RangePreset } from '../../lib/rangePresets'

interface RangePresetMenuProps {
  presets: RangePreset[]
  /** Id of the preset the current dates match, if any. */
  activeId: string | null
  onPick: (preset: RangePreset) => void
}

/**
 * "Quick ranges" as one compact dropdown on the tab row — All time, last 7 /
 * 30 days, this / last month. The trigger names the range in force, so the
 * choice stays visible after the menu closes.
 */
export default function RangePresetMenu({ presets, activeId, onPick }: RangePresetMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const active = presets.find((p) => p.id === activeId)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-[34px] items-center gap-1.5 rounded-btn border px-3 text-[12.5px] font-bold font-body cursor-pointer transition-colors ${
          open || active
            ? 'border-accent-line bg-accent-soft text-accent'
            : 'border-border bg-surface2 text-muted hover:text-text hover:border-accent-line'
        }`}
      >
        <CalendarRange size={14} />
        {active ? active.label : 'Quick ranges'}
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-30 flex w-[170px] flex-col gap-0.5 rounded-row border border-border bg-surface p-[5px] shadow-[0_12px_32px_rgba(0,0,0,0.25)] animate-[fadeup_0.16s_ease-out]"
        >
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitem"
              className={`text-left border-none text-[12.5px] py-2 px-2.5 rounded-btn cursor-pointer font-body ${
                p.id === activeId
                  ? 'bg-accent-soft text-accent font-bold'
                  : 'bg-transparent text-muted font-semibold hover:bg-surface2 hover:text-text'
              }`}
              onClick={() => {
                onPick(p)
                setOpen(false)
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
