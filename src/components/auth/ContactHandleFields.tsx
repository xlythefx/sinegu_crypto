import { DiscordMark, TelegramMark } from '../ui/BrandIcons'

const FIELD =
  'h-12 w-full rounded-[12px] border border-border bg-surface2 pr-4 pl-11 font-body text-[14px] text-text outline-none transition-[border-color,box-shadow] duration-200 focus:border-accent focus:shadow-[0_0_0_3px_var(--glowAuth)]'

// `placeholder` is short on purpose: two fields share one row on the form.
const PLATFORMS = {
  telegram: { label: 'Telegram username', placeholder: 'Your Telegram', Icon: TelegramMark, color: 'text-[#229ED9]' },
  discord: { label: 'Discord username', placeholder: 'Your Discord', Icon: DiscordMark, color: 'text-[#5865F2]' },
} as const

interface HandleInputProps {
  platform: keyof typeof PLATFORMS
  value: string
  onChange: (value: string) => void
  /** Field class override — Settings uses its own, shorter input style (keep `pl-11` for the icon). */
  fieldClass?: string
}

/** One optional username field with the platform's mark inside it. */
export function HandleInput({ platform, value, onChange, fieldClass = FIELD }: HandleInputProps) {
  const { label, placeholder, Icon, color } = PLATFORMS[platform]
  return (
    <label className="relative block min-w-0">
      <span className="sr-only">{label} (optional)</span>
      <span className={`pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 ${color}`}>
        <Icon size={17} />
      </span>
      <input
        type="text"
        className={fieldClass}
        placeholder={placeholder}
        title={label}
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

interface Props {
  telegram: string
  onTelegramChange: (value: string) => void
  /** Omit both to show Telegram alone (a Discord sign-up already knows its username). */
  discord?: string
  onDiscordChange?: (value: string) => void
}

/**
 * The optional Telegram / Discord usernames on the sign-up forms (Settings
 * lays out its own {@link HandleInput}s). Typed, not verified — the API
 * normalises (`@`, `t.me/` links, Discord's lowercase) and refuses a shape no
 * username can have; that is all it can check.
 */
export default function ContactHandleFields({
  telegram,
  onTelegramChange,
  discord,
  onDiscordChange,
}: Props) {
  const withDiscord = discord !== undefined && onDiscordChange !== undefined

  return (
    <div className={`grid gap-2.5 ${withDiscord ? 'grid-cols-2 max-[520px]:grid-cols-1' : ''}`}>
      <HandleInput platform="telegram" value={telegram} onChange={onTelegramChange} />
      {withDiscord && <HandleInput platform="discord" value={discord} onChange={onDiscordChange} />}
    </div>
  )
}
