import { DiscordMark, TelegramMark } from '../ui/BrandIcons'

const FIELD =
  'h-12 w-full rounded-[12px] border border-border bg-surface2 pr-4 pl-11 font-body text-[14px] text-text outline-none transition-[border-color,box-shadow] duration-200 focus:border-accent focus:shadow-[0_0_0_3px_var(--glowAuth)]'

const PLATFORMS = {
  telegram: { label: 'Telegram username', Icon: TelegramMark, color: 'text-[#229ED9]' },
  discord: { label: 'Discord username', Icon: DiscordMark, color: 'text-[#5865F2]' },
} as const

interface HandleInputProps {
  platform: keyof typeof PLATFORMS
  value: string
  onChange: (value: string) => void
  /** Field class override — Settings uses its own, shorter input style (keep `pl-11` for the icon). */
  fieldClass?: string
}

/**
 * One optional Telegram / Discord username field with the platform's mark
 * inside it — the sign-up wizards' socials step and Settings. Typed, not
 * verified: the API normalises (`@`, `t.me/` links, Discord's lowercase) and
 * refuses a shape no username can have; that is all it can check.
 */
export default function HandleInput({ platform, value, onChange, fieldClass = FIELD }: HandleInputProps) {
  const { label, Icon, color } = PLATFORMS[platform]
  return (
    <label className="relative block min-w-0">
      <span className="sr-only">{label} (optional)</span>
      <span className={`pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 ${color}`}>
        <Icon size={17} />
      </span>
      <input
        type="text"
        className={fieldClass}
        placeholder={label}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        maxLength={64}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
