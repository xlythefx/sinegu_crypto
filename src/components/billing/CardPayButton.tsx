import { CreditCard, ExternalLink, FlaskConical, Loader2, Zap } from 'lucide-react'

export type CardTone = 'normal' | 'test' | 'live'

interface CardPayButtonProps {
  title: string
  subtitle: string
  /** `test` = sandbox badge; `live` = the developer's REAL-charge button, in red. */
  tone: CardTone
  /** This button's checkout is being opened. */
  loading: boolean
  loadingLabel: string
  disabled: boolean
  onClick: () => void
  className?: string
}

const TONE_CLASS: Record<CardTone, string> = {
  normal: 'border-border bg-surface2 hover:border-accent',
  test: 'border-accent-line bg-surface2 hover:border-accent',
  live: 'border-[color-mix(in_srgb,var(--red)_45%,transparent)] bg-[color-mix(in_srgb,var(--red)_7%,transparent)] hover:border-red',
}

/** One "pay by card" row — opens Stripe's hosted checkout. */
export default function CardPayButton({
  title,
  subtitle,
  tone,
  loading,
  loadingLabel,
  disabled,
  onClick,
  className = '',
}: CardPayButtonProps) {
  return (
    <button
      type="button"
      className={`w-full flex items-center gap-3 text-left rounded-[14px] border p-4 max-[420px]:p-3.5 cursor-pointer transition-[border-color] duration-150 disabled:opacity-60 disabled:cursor-not-allowed ${TONE_CLASS[tone]} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span
        className={`w-9 h-9 flex-shrink-0 grid place-items-center rounded-[10px] border ${
          tone === 'live'
            ? 'border-[color-mix(in_srgb,var(--red)_45%,transparent)] text-red'
            : 'border-accent-line bg-[var(--bubble)] text-accent'
        }`}
      >
        {loading ? (
          <Loader2 size={16} className="animate-[dstate-spin_0.8s_linear_infinite]" />
        ) : (
          <CreditCard size={16} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 flex-wrap text-[13.5px] font-bold text-text">
          {loading ? loadingLabel : title}
          {tone === 'test' && (
            <span className="inline-flex items-center gap-1 rounded-pill border border-accent-line bg-[var(--bubble)] py-0.5 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-accent">
              <FlaskConical size={10} /> Sandbox
            </span>
          )}
          {tone === 'live' && (
            <span className="inline-flex items-center gap-1 rounded-pill border border-[color-mix(in_srgb,var(--red)_45%,transparent)] py-0.5 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-red">
              <Zap size={10} /> Live · real money
            </span>
          )}
        </span>
        <span className="block text-[11.5px] text-muted mt-0.5">{subtitle}</span>
      </span>
      <ExternalLink size={15} className="flex-shrink-0 text-faint" />
    </button>
  )
}
