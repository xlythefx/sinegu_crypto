import { Check } from 'lucide-react'

/** The round tick box — a real checkbox to assistive tech. */
export default function TickBox({
  checked,
  onToggle,
  label,
  size = 'md',
  number,
}: {
  checked: boolean
  onToggle: () => void
  label: string
  size?: 'sm' | 'md'
  number?: number
}) {
  const dims = size === 'md' ? 'h-10 w-10 text-[14px]' : 'h-6 w-6 text-[11px]'
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={`grid flex-none place-items-center rounded-full border-2 font-mono font-bold transition-colors duration-150 ${dims} ${
        checked
          ? 'border-green bg-green text-white'
          : 'border-border bg-surface2 text-accent hover:border-accent'
      }`}
    >
      {checked ? <Check size={size === 'md' ? 18 : 13} strokeWidth={3} /> : number}
    </button>
  )
}
