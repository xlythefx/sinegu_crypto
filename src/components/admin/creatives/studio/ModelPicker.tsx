import { Film, Image as ImageIcon } from 'lucide-react'
import type { CreativeModelPreset } from '../../../../types/creatives'

interface ModelPickerProps {
  models: CreativeModelPreset[]
  value: string
  onChange: (key: string) => void
  disabled?: boolean
}

/**
 * The model presets the server offers, as radio cards: what each makes, a
 * one-line description and a rough price. Rendered from the API's list, so a
 * preset added on the server shows up without a frontend change.
 */
export default function ModelPicker({ models, value, onChange, disabled }: ModelPickerProps) {
  return (
    <div role="radiogroup" aria-label="Model" className="grid grid-cols-1 gap-2.5 @lg:grid-cols-2">
      {models.map((m) => {
        const on = m.key === value
        const Icon = m.kind === 'video' ? Film : ImageIcon
        return (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(m.key)}
            className={`flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-row border p-3.5 text-left transition-[border-color,background] duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
              on
                ? 'border-accent-line bg-[linear-gradient(160deg,var(--accentSoft),var(--surface))]'
                : 'border-border bg-surface2 hover:border-accent-line'
            }`}
          >
            <span className="flex min-w-0 items-start gap-2">
              <Icon size={15} aria-hidden="true" className={`mt-px flex-none ${on ? 'text-accent' : 'text-muted'}`} />
              <span className="min-w-0 flex-1 text-[13px] font-bold leading-[1.35] text-text">{m.label}</span>
              <span
                aria-hidden="true"
                className={`mt-0.5 h-3.5 w-3.5 flex-none rounded-full border-2 ${on ? 'border-accent bg-accent' : 'border-border'}`}
              />
            </span>
            <span className="text-[12px] leading-[1.5] text-muted">{m.description}</span>
            <span className="font-mono text-[11px] text-faint">
              {m.kind === 'video' ? 'Video' : 'Image'} · {m.price_hint}
            </span>
          </button>
        )
      })}
    </div>
  )
}
