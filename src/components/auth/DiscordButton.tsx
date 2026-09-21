import { DiscordMark } from '../ui/BrandIcons'

interface DiscordButtonProps {
  label?: string
  onClick: () => void
  disabled?: boolean
  /** Render the "or" divider above the button (the sign-in form does; standalone pages do not). */
  divider?: boolean
  className?: string
}

/** Discord's blurple, kept fixed in both themes — it is their brand, not ours. */
const BUTTON =
  'inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-[12px] border-0 bg-[#5865F2] font-body text-[14.5px] font-bold text-white shadow-[0_10px_24px_rgba(88,101,242,0.28)] transition-[transform,filter] duration-200 hover:-translate-y-0.5 hover:brightness-110 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100'

/** "Continue with Discord" — the one place the brand button is drawn. */
export default function DiscordButton({
  label = 'Continue with Discord',
  onClick,
  disabled = false,
  divider = false,
  className = '',
}: DiscordButtonProps) {
  return (
    <div className={className}>
      {divider && (
        <div className="my-[18px] flex items-center gap-3 text-[11.5px] font-mono uppercase tracking-[0.12em] text-faint">
          <span className="h-px flex-1 bg-hair" />
          or
          <span className="h-px flex-1 bg-hair" />
        </div>
      )}
      <button type="button" className={BUTTON} onClick={onClick} disabled={disabled}>
        <DiscordMark size={20} />
        {label}
      </button>
    </div>
  )
}
