import { Link } from 'react-router-dom'
import { BadgePercent, ChevronRight, CornerDownRight } from 'lucide-react'
import type { GuidePart } from '../../lib/binanceGuide'
import { withBold } from './withBold'

/**
 * The head of a guide part. A skippable part (Part 1, "create your Binance
 * account") offers the skip; once skipped it shrinks to one line the reader
 * can reopen, so nobody who already has Binance scrolls past four steps.
 */
export default function GuidePartHeader({
  part,
  skipped,
  onSkip,
  onShow,
}: {
  part: GuidePart
  skipped: boolean
  onSkip: () => void
  onShow: () => void
}) {
  if (skipped) {
    return (
      <div
        id={`part-${part.id}`}
        className="scroll-mt-8 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface px-5 py-4"
      >
        <div className="min-w-0 text-[14px] leading-snug text-muted">
          <span className="font-mono text-[11px] uppercase tracking-widest text-faint">
            {part.label}
          </span>{' '}
          · {part.title} — skipped, you already have Binance.
        </div>
        <button
          type="button"
          onClick={onShow}
          className="text-[13px] font-bold text-accent underline-offset-2 hover:underline"
        >
          Show {part.label}
        </button>
      </div>
    )
  }

  return (
    <header id={`part-${part.id}`} data-aos="fade-up" className="scroll-mt-8">
      <div className="font-mono text-[12px] font-semibold uppercase tracking-widest text-accent">
        {part.label}
      </div>
      <h2 className="mt-1.5 font-display text-[34px] font-extrabold tracking-[-0.02em] leading-tight max-[560px]:text-[26px]">
        {part.title}
      </h2>
      <p className="mt-3 max-w-[70ch] text-[15.5px] leading-[1.75] text-muted">
        {withBold(part.intro)}
      </p>

      {part.offer && (
        <Link
          to={part.offer.to}
          className="group mt-5 flex items-center gap-3.5 rounded-card border border-accent-line bg-accent-soft p-4 transition-colors hover:border-accent max-[560px]:items-start"
        >
          <BadgePercent size={20} className="shrink-0 text-accent max-[560px]:mt-0.5" />
          <span className="min-w-0 flex-1 text-[14.5px] leading-[1.6] text-text">
            {part.offer.text}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-bold text-accent max-[560px]:hidden">
            See the offer
            <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      )}

      {part.skippable && (
        <button
          type="button"
          onClick={onSkip}
          className="mt-4 inline-flex items-center gap-2 text-[13.5px] font-semibold text-muted transition-colors hover:text-text"
        >
          <CornerDownRight size={14} />
          I already have a Binance account — skip to the next part
        </button>
      )}
    </header>
  )
}
