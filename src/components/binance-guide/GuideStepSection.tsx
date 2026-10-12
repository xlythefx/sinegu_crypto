import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronRight, ExternalLink, Lightbulb, TriangleAlert, ZoomIn } from 'lucide-react'
import CopyState from '../ui/CopyState'
import type { GuideStep } from '../../lib/binanceGuide'
import { FALLBACK_SERVER_IP } from '../../lib/serverIp'
import TickBox from './TickBox'
import { withBold } from './withBold'
import { GUIDE_GHOST, GUIDE_PRIMARY } from './guideClasses'

function IpBlock() {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(FALLBACK_SERVER_IP)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the address is selectable in place */
    }
  }

  return (
    <div className="my-5 rounded-card border border-accent-line bg-accent-soft p-4">
      <div className="font-mono text-[11px] uppercase tracking-widest text-faint">
        Pixel Alpha server IP — paste this
      </div>
      <div className="mt-2.5 flex items-center gap-3">
        <code className="min-w-0 flex-1 break-all font-mono text-[17px] font-bold tracking-[0.02em] text-text">
          {FALLBACK_SERVER_IP}
        </code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex flex-none items-center gap-1.5 rounded-btn border border-border bg-surface px-3 py-2 text-[12px] font-bold text-text transition-colors hover:border-accent"
        >
          <CopyState copied={copied} />
        </button>
      </div>
    </div>
  )
}

function StepLink({ link }: { link: NonNullable<GuideStep['link']> }) {
  if (link.to) {
    return (
      <Link to={link.to} className={GUIDE_PRIMARY}>
        {link.label}
        <ChevronRight size={15} />
      </Link>
    )
  }
  return (
    <a className={GUIDE_GHOST} href={link.href} target="_blank" rel="noreferrer noopener">
      {link.label}
      <ExternalLink size={14} />
    </a>
  )
}

/** One step of the guide: tick box, title, the clicks, callouts, screenshots. */
export default function GuideStepSection({
  step,
  index,
  total,
  partLabel,
  checked,
  isLast,
  onToggle,
  onCompleteAndNext,
  onZoom,
}: {
  step: GuideStep
  index: number
  total: number
  partLabel: string
  checked: boolean
  /** The last visible step of the whole guide. */
  isLast: boolean
  onToggle: (value?: boolean) => void
  onCompleteAndNext: () => void
  onZoom: (image: { src: string; alt: string }) => void
}) {
  return (
    <section
      id={`step-${step.id}`}
      data-aos="fade-up"
      className="scroll-mt-8 mt-10 border-t border-hair pt-10"
    >
      <div className="flex items-start gap-4">
        <TickBox
          checked={checked}
          number={index + 1}
          onToggle={() => onToggle()}
          label={`Mark ${partLabel}, step ${index + 1} as done: ${step.title}`}
        />
        <div className="min-w-0">
          <div className="font-mono text-[11px] uppercase tracking-widest text-faint">
            {partLabel} · Step {index + 1} of {total}
            {checked && <span className="ml-2 text-green">· Done</span>}
          </div>
          <h3 className="mt-1 font-display text-[26px] font-extrabold tracking-[-0.02em] leading-tight max-[560px]:text-[21px]">
            {step.title}
          </h3>
        </div>
      </div>

      <div className="mt-5 max-w-[76ch]">
        <p className="text-[15.5px] leading-[1.75] text-muted">{withBold(step.summary)}</p>

        <ol className="mt-5 flex flex-col gap-3">
          {step.actions.map((action, n) => (
            <li key={action} className="flex gap-3.5">
              <span className="mt-[1px] grid h-6 w-6 flex-none place-items-center rounded-full bg-accent-soft font-mono text-[11.5px] font-bold text-accent">
                {n + 1}
              </span>
              <span className="text-[15px] leading-[1.7] text-text">{withBold(action)}</span>
            </li>
          ))}
        </ol>

        {step.ip && <IpBlock />}

        {step.warning && (
          <div className="my-5 flex gap-3.5 rounded-card border border-accent-line bg-accent-soft p-5 max-[560px]:p-4">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-accent" />
            <p className="text-[14.5px] leading-[1.7] text-text">{withBold(step.warning)}</p>
          </div>
        )}

        {step.tip && (
          <p className="my-5 flex gap-3 text-[14px] leading-[1.7] text-muted">
            <Lightbulb size={16} className="mt-[3px] shrink-0 text-green" />
            <span>{withBold(step.tip)}</span>
          </p>
        )}
      </div>

      {step.images && (
        <div className="mt-6 flex flex-wrap items-start gap-4">
          {step.images.map((src, n) => {
            const alt = `${partLabel}, step ${index + 1}: ${step.title}${
              step.images!.length > 1 ? ` (${n + 1})` : ''
            }`
            return (
              <button
                key={src}
                type="button"
                onClick={() => onZoom({ src, alt })}
                className="group relative block max-w-[820px] cursor-zoom-in overflow-hidden rounded-card border border-border bg-surface2 transition-colors hover:border-accent"
              >
                <img
                  src={src}
                  alt={alt}
                  loading="lazy"
                  className="block h-auto max-h-[520px] w-auto max-w-full object-contain"
                />
                <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface/90 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-muted opacity-0 transition-opacity group-hover:opacity-100">
                  <ZoomIn size={12} />
                  Zoom
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3 max-[560px]:flex-col max-[560px]:items-stretch">
        {step.link && <StepLink link={step.link} />}
        {checked ? (
          <button
            type="button"
            onClick={() => onToggle(false)}
            className="inline-flex items-center justify-center gap-2 rounded-pill border border-green px-5 py-3 text-[14px] font-bold text-green transition-colors hover:bg-surface2"
          >
            <Check size={15} strokeWidth={3} />
            Done — tap to undo
          </button>
        ) : (
          <button type="button" onClick={onCompleteAndNext} className={GUIDE_GHOST}>
            <Check size={15} />
            {isLast ? 'I’ve done this' : 'Done — next step'}
          </button>
        )}
      </div>
    </section>
  )
}
