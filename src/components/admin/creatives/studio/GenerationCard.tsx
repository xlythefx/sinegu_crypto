import { useState, type MouseEvent } from 'react'
import {
  Ban,
  CircleAlert,
  CircleCheck,
  Clock,
  Download,
  Film,
  Image as ImageIcon,
  ImageOff,
  LoaderCircle,
  Play,
  UserRoundPlus,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { fmtDateTime } from '../../../../lib/format'
import {
  EXPIRY_WARN_MS,
  fmtCost,
  fmtTimeLeft,
  GENERATION_STATUS,
  isExpiredGeneration,
  msUntilExpiry,
  signedUrl,
} from '../../../../lib/creatives'
import type { CreativeGeneration } from '../../../../types/creatives'
import TonePill from '../TonePill'
import { BTN_SOFT, BTN_SOFT_DANGER, FACT_LABEL, FACT_VALUE, LINK_PRIMARY } from '../creativeClasses'
import { GENERATION_ICON } from '../creativeIcons'

interface GenerationCardProps {
  generation: CreativeGeneration
  now: number
  retentionDays: number
  /** Starts the download; resolves to an error sentence, or null when it started. */
  onDownload: (generation: CreativeGeneration, index: number) => Promise<string | null>
  onAnimate: (generation: CreativeGeneration, index: number) => void
  /** Resolves to a result sentence (added / why not). */
  onUseAsRef: (generation: CreativeGeneration, index: number) => Promise<{ ok: boolean; message: string }>
  onCancel: (generation: CreativeGeneration) => void
}

// One fixed track: an auto row would grow to the picture's own height and crop it instead of fitting it.
const PREVIEW_BOX =
  'relative grid h-[240px] w-full grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] place-items-center overflow-hidden rounded-row border border-hair bg-surface2 sm:h-[280px]'

/** What the preview area says when there is nothing to show. */
function EmptyPreview({ generation, retentionDays }: { generation: CreativeGeneration; retentionDays: number }) {
  const s = generation.status
  const charged = generation.charged_usd > 0
  const view: { Icon: LucideIcon; title: string; line: string } =
    s === 'submitting' || s === 'queued' || s === 'in_progress'
      ? {
          Icon: LoaderCircle,
          title:
            s === 'queued'
              ? 'Waiting in Higgsfield’s queue'
              : s === 'submitting'
                ? 'Sending to Higgsfield'
                : 'Higgsfield is making it',
          line: 'This page checks every few seconds.',
        }
      : s === 'failed'
        ? {
            Icon: CircleAlert,
            title: 'Higgsfield could not make this one',
            line: charged
              ? 'Its cost stays counted this month until Higgsfield’s usage page shows it was not charged.'
              : 'It was not charged.',
          }
        : s === 'nsfw'
          ? { Icon: CircleAlert, title: 'Blocked by Higgsfield’s safety check', line: 'It was not charged. Try a different prompt.' }
          : s === 'canceled'
            ? { Icon: Ban, title: 'Cancelled before it started', line: 'It was not charged.' }
            : {
                Icon: ImageOff,
                title: 'Deleted by Higgsfield',
                line: `Results are kept for ${retentionDays} days. The record stays: prompt, cost and who made it.`,
              }
  const { Icon, title, line } = view
  const spinning = Icon === LoaderCircle
  return (
    <div className="flex max-w-[280px] flex-col items-center gap-2 px-4 text-center">
      <Icon
        size={22}
        aria-hidden="true"
        className={spinning ? 'animate-spin text-accent' : s === 'failed' || s === 'nsfw' ? 'text-red' : 'text-faint'}
      />
      <p className="text-[13px] font-bold text-text">{title}</p>
      <p className="text-[12px] leading-[1.5] text-muted">{line}</p>
    </div>
  )
}

/**
 * One generation in the gallery: status, preview, prompt, cost, who made it,
 * its plan and how long Higgsfield keeps it. A batch of several pictures has
 * a strip of thumbnails; the actions apply to the picture shown.
 */
export default function GenerationCard({
  generation: g,
  now,
  retentionDays,
  onDownload,
  onAnimate,
  onUseAsRef,
  onCancel,
}: GenerationCardProps) {
  const [index, setIndex] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [broken, setBroken] = useState(false)
  const [working, setWorking] = useState<'download' | 'ref' | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const expired = isExpiredGeneration(g, now)
  const status = expired ? 'expired' : g.status
  const meta = GENERATION_STATUS[status]
  const outputs = expired ? [] : g.outputs
  const shown = outputs[Math.min(index, Math.max(0, outputs.length - 1))] ?? null
  const shownIndex = shown ? outputs.indexOf(shown) : 0
  const isImage = shown?.type === 'image'
  const left = msUntilExpiry(g, now)
  const longPrompt = g.prompt.length > 160
  const pending = meta.pending

  const download = async (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    setWorking('download')
    setMessage(null)
    const problem = await onDownload(g, shownIndex)
    if (problem) setMessage({ ok: false, text: problem })
    setWorking(null)
  }

  const keep = async () => {
    setWorking('ref')
    setMessage(null)
    const result = await onUseAsRef(g, shownIndex)
    setMessage({ ok: result.ok, text: result.message })
    setWorking(null)
  }

  const cost =
    pending
      ? `${fmtCost(g.charged_usd || g.estimated_usd)} reserved`
      : g.charged_usd > 0
        ? fmtCost(g.charged_usd)
        : 'Not charged'

  const StatusIcon = GENERATION_ICON[status]
  const KindIcon = g.kind === 'video' ? Film : ImageIcon

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-row border border-border bg-surface2/60 p-3.5">
      <header className="flex min-w-0 items-start gap-2">
        <KindIcon size={15} aria-hidden="true" className="mt-0.5 flex-none text-muted" />
        <p className="min-w-0 flex-1 text-[13px] font-bold leading-[1.4] text-text">{g.model_label}</p>
        <TonePill tone={meta.tone} icon={StatusIcon}>
          {meta.label}
        </TonePill>
      </header>

      <div className={PREVIEW_BOX}>
        {shown && !broken ? (
          shown.type === 'video' ? (
            <video
              key={shown.url}
              src={shown.url}
              controls
              playsInline
              preload="metadata"
              className="h-full w-full object-contain"
              onError={() => setBroken(true)}
            />
          ) : (
            <img
              key={shown.url}
              src={shown.url}
              alt={`Result of: ${g.prompt.slice(0, 80)}`}
              loading="lazy"
              className="h-full w-full object-contain"
              onError={() => setBroken(true)}
            />
          )
        ) : shown && broken ? (
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <ImageOff size={22} aria-hidden="true" className="text-faint" />
            <p className="text-[12px] leading-[1.5] text-muted">The preview did not load. Download may still work.</p>
          </div>
        ) : (
          <EmptyPreview generation={{ ...g, status }} retentionDays={retentionDays} />
        )}
      </div>

      {outputs.length > 1 && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pictures in this batch">
          {outputs.map((o, i) => (
            <button
              key={o.url}
              type="button"
              role="radio"
              aria-checked={i === shownIndex}
              aria-label={`Picture ${i + 1}`}
              onClick={() => {
                setIndex(i)
                setBroken(false)
                setMessage(null)
              }}
              className={`h-12 w-12 cursor-pointer overflow-hidden rounded-[9px] border-2 bg-surface2 ${
                i === shownIndex ? 'border-accent' : 'border-transparent hover:border-accent-line'
              }`}
            >
              {o.type === 'image' ? (
                <img src={o.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <Play size={14} aria-hidden="true" className="m-auto text-muted" />
              )}
            </button>
          ))}
        </div>
      )}

      <div>
        <p className={`break-words text-[12.5px] leading-[1.55] text-text ${expanded ? '' : 'line-clamp-3'}`} title={g.prompt}>
          {g.prompt}
        </p>
        {longPrompt && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 cursor-pointer text-[12px] font-semibold text-accent underline-offset-2 hover:underline"
          >
            {expanded ? 'Show less' : 'Show the whole prompt'}
          </button>
        )}
        {g.status === 'failed' && g.error && (
          <p className="mt-1.5 break-words text-[12px] leading-[1.5] text-red">{g.error}</p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        <div>
          <dt className={FACT_LABEL}>Cost</dt>
          <dd className={FACT_VALUE}>{cost}</dd>
        </div>
        <div className="min-w-0">
          <dt className={FACT_LABEL}>Made by</dt>
          <dd className={`${FACT_VALUE} truncate`}>{g.created_by_name ?? '—'}</dd>
        </div>
        <div className="min-w-0">
          <dt className={FACT_LABEL}>When</dt>
          <dd className={FACT_VALUE}>{fmtDateTime(g.created_at)}</dd>
        </div>
        <div className="min-w-0">
          <dt className={FACT_LABEL}>Plan</dt>
          <dd className={`${FACT_VALUE} truncate`} title={g.plan_title ?? undefined}>
            {g.plan_title ?? 'No plan'}
          </dd>
        </div>
      </dl>

      {g.status === 'completed' && !expired && left !== null && (
        <p
          className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${
            left < EXPIRY_WARN_MS ? 'text-red' : 'text-muted'
          }`}
        >
          <Clock size={13} aria-hidden="true" className="flex-none" />
          Deleted by Higgsfield in {fmtTimeLeft(left)}
        </p>
      )}
      {g.used_character && (
        <p className="inline-flex items-center gap-1.5 text-[11.5px] text-faint">
          <CircleCheck size={12} aria-hidden="true" className="flex-none" />
          Made with the character
        </p>
      )}

      {message && (
        <p className={`text-[12px] font-semibold leading-[1.5] ${message.ok ? 'text-green' : 'text-red'}`} role="status">
          {message.text}
        </p>
      )}

      {(shown || g.status === 'queued') && (
        <div className="flex flex-wrap gap-2 border-t border-hair pt-3">
          {shown && (
            <a
              href={signedUrl(shown.download_path)}
              target="_blank"
              rel="noopener"
              onClick={(e) => void download(e)}
              className={`${LINK_PRIMARY} ${working === 'download' ? 'pointer-events-none opacity-70' : ''}`}
              aria-label={`Download ${shown.type === 'video' ? 'the video' : 'the picture'}`}
            >
              <Download size={14} aria-hidden="true" />
              {working === 'download' ? 'Preparing…' : 'Download'}
            </a>
          )}
          {isImage && (
            <>
              <button type="button" className={BTN_SOFT} onClick={() => onAnimate(g, shownIndex)}>
                <Play size={14} aria-hidden="true" />
                Animate
              </button>
              <button type="button" className={BTN_SOFT} onClick={() => void keep()} disabled={working === 'ref'}>
                <UserRoundPlus size={14} aria-hidden="true" />
                {working === 'ref' ? 'Adding…' : 'Use as character reference'}
              </button>
            </>
          )}
          {g.status === 'queued' && (
            <button type="button" className={BTN_SOFT_DANGER} onClick={() => onCancel(g)}>
              <Ban size={14} aria-hidden="true" />
              Cancel
            </button>
          )}
        </div>
      )}
    </article>
  )
}
