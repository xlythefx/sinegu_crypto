import { LoaderCircle } from 'lucide-react'

interface ToggleSwitchProps {
  on: boolean
  onChange: (on: boolean) => void
  label: string
  disabled?: boolean
  busy?: boolean
  /** Show "On" / "Off" beside the switch (default true). */
  showState?: boolean
}

/** The page's on/off switch (the weekly-recap switch's look), with a 36px+ tap target. */
export default function ToggleSwitch({ on, onChange, label, disabled, busy, showState = true }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={label}
      onClick={() => onChange(!on)}
      disabled={disabled || busy}
      className="inline-flex min-h-9 flex-none cursor-pointer items-center gap-2 rounded-pill bg-transparent py-1 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy && <LoaderCircle size={13} className="animate-spin text-muted" aria-hidden="true" />}
      {showState && <span className={`text-[12.5px] font-semibold ${on ? 'text-accent' : 'text-muted'}`}>{on ? 'On' : 'Off'}</span>}
      <span
        className={`relative inline-block h-5 w-9 flex-none rounded-pill border transition-[background,border-color] duration-150 ${
          on ? 'border-accent bg-accent-soft' : 'border-border bg-surface'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-[14px] w-[14px] rounded-full transition-[transform,background] duration-150 ${
            on ? 'translate-x-4 bg-accent' : 'bg-muted'
          }`}
        />
      </span>
    </button>
  )
}
