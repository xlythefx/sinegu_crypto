import { useEffect, type ReactNode } from 'react'

interface InfoModalProps {
  open: boolean
  /** Lucide icon rendered in a floating accent chip above the title. */
  icon?: ReactNode
  title: string
  message?: string
  ctaLabel: string
  onCta: () => void
  /** Secondary "Maybe later"-style button; omit for a single-button modal. */
  dismissLabel?: string
  /** Fires on backdrop click, Escape, and the dismiss button. */
  onDismiss: () => void
}

/**
 * Informational modal with a single primary CTA — the announcement counterpart
 * to ConfirmModal (which is strictly yes/no). Same backdrop/panel recipe.
 *
 * Usage:
 *   <InfoModal
 *     open={open}
 *     icon={<Hourglass size={30} />}
 *     title="You're currently still pending approval"
 *     message="An admin will review your account shortly."
 *     ctaLabel="Got it"
 *     onCta={close}
 *     onDismiss={close}
 *   />
 */
export default function InfoModal({
  open,
  icon,
  title,
  message,
  ctaLabel,
  onCta,
  dismissLabel,
  onDismiss,
}: InfoModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onDismiss])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-[rgba(0,0,0,0.55)] backdrop-blur-[3px] grid place-items-center z-[1000] animate-[fadeup_0.2s_ease_both]"
      onClick={onDismiss}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="bg-surface border border-border rounded-[20px] p-7 max-w-[440px] w-[calc(100%-48px)] shadow-[0_30px_80px_rgba(0,0,0,0.35)] animate-[fadeup_0.25s_cubic-bezier(0.2,0.7,0.2,1)_both] text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {icon && (
          <div className="mx-auto mb-[18px] flex h-[64px] w-[64px] animate-[float_3s_ease-in-out_infinite] items-center justify-center rounded-[18px] border border-accent-line bg-accent-soft text-accent">
            {icon}
          </div>
        )}
        <h3 className="font-display text-[20px] font-extrabold tracking-[-0.02em] mb-2 text-text">
          {title}
        </h3>
        {message && (
          <p className="text-[14px] leading-[1.6] text-muted mb-[22px]">
            {message}
          </p>
        )}
        <div className="flex gap-2.5 justify-center flex-wrap">
          {dismissLabel && (
            <button
              className="text-[14px] font-semibold bg-surface2 text-text border border-border py-[11px] px-[22px] rounded-pill cursor-pointer"
              onClick={onDismiss}
            >
              {dismissLabel}
            </button>
          )}
          <button
            className="text-[14px] font-bold py-[11px] px-[22px] rounded-pill border-0 cursor-pointer bg-accent text-on-accent shadow-[0_10px_24px_var(--glow)]"
            onClick={onCta}
            autoFocus
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
