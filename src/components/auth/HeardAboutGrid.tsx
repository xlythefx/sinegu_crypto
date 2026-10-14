import type { ComponentType } from 'react'
import { Check, Ellipsis, Search, Smartphone, Sparkles, Users } from 'lucide-react'
import { DiscordMark, TelegramMark, XMark, YouTubeMark } from '../ui/BrandIcons'
import {
  SIGNUP_SOURCES,
  SIGNUP_SOURCE_OTHER_MAX,
  type SignupSource,
} from '../../lib/signupSources'
import { INPUT } from './authClasses'

const ICONS: Record<SignupSource, ComponentType<{ size: number }>> = {
  discord: DiscordMark,
  telegram: TelegramMark,
  ai: Sparkles,
  friend: Users,
  youtube: YouTubeMark,
  x: XMark,
  google: Search,
  social: Smartphone,
  other: Ellipsis,
}

const TILE =
  'relative flex min-h-[76px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[12px] border px-1.5 py-2.5 text-center transition-[border-color,background,color] duration-150 focus-within:shadow-[0_0_0_3px_var(--glowAuth)]'
const TILE_ON = 'border-accent bg-accent-soft text-accent'
const TILE_OFF = 'border-border bg-surface2 text-muted hover:border-accent-line hover:text-text'

interface Props {
  value: SignupSource[]
  onChange: (next: SignupSource[]) => void
  other: string
  onOtherChange: (text: string) => void
  /** Keep the question for screen readers only — the wizard step's title already asks it. */
  hideLegend?: boolean
}

/**
 * "Where did you hear about us?" — nine checkable tiles, always 3 × 3 (the
 * owner's layout, phone included), any number ticked, all optional. Each
 * tile is a real checkbox inside its label, so keyboard and screen readers
 * get the native control; the tile is only its skin. Ticking "Other" opens a
 * free-text line under the grid.
 */
export default function HeardAboutGrid({
  value,
  onChange,
  other,
  onOtherChange,
  hideLegend = false,
}: Props) {
  const toggle = (slug: SignupSource) =>
    onChange(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug])

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className={hideLegend ? 'sr-only' : 'mb-2.5 p-0 text-[13px] font-semibold text-text'}>
        Where did you hear about us?{' '}
        <span className="font-normal text-faint">Optional · tick all that apply</span>
      </legend>

      <div className="grid grid-cols-3 gap-2">
        {SIGNUP_SOURCES.map(({ slug, label, hint }) => {
          const on = value.includes(slug)
          const Icon = ICONS[slug]
          return (
            <label key={slug} className={`${TILE} ${on ? TILE_ON : TILE_OFF}`}>
              <input
                type="checkbox"
                className="sr-only"
                checked={on}
                onChange={() => toggle(slug)}
              />
              {on && (
                <span className="absolute top-1.5 right-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-accent text-on-accent">
                  <Check size={10} strokeWidth={3} />
                </span>
              )}
              <Icon size={18} />
              <span className={`text-[12px] leading-[1.25] font-semibold ${on ? 'text-accent' : 'text-text'}`}>
                {label}
              </span>
              {hint && <span className="text-[10.5px] leading-[1.2] text-faint">{hint}</span>}
            </label>
          )
        })}
      </div>

      {value.includes('other') && (
        <input
          type="text"
          className={`${INPUT} mt-2.5`}
          placeholder="Where? (optional)"
          aria-label="Where did you hear about us — other"
          value={other}
          maxLength={SIGNUP_SOURCE_OTHER_MAX}
          onChange={(e) => onOtherChange(e.target.value)}
        />
      )}
    </fieldset>
  )
}
