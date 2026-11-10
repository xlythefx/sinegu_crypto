import { useState, type MouseEvent } from 'react'
import { Clock, Download, ImageOff, LoaderCircle, Play } from 'lucide-react'
import {
  EXPIRY_WARN_MS,
  fmtTimeLeft,
  isExpiredGeneration,
  isPendingGeneration,
  msUntilExpiry,
  signedUrl,
} from '../../../../../lib/creatives'
import type { CreativeGeneration } from '../../../../../types/creatives'
import { LINK_PRIMARY } from '../../creativeClasses'

interface StepPreviewProps {
  generation: CreativeGeneration
  now: number
  retentionDays: number
  /** Starts the download; resolves to an error sentence, or null when it started. */
  onDownload: (generation: CreativeGeneration, index: number) => Promise<string | null>
}

/**
 * A job step's result inside its card: the picture or video while Higgsfield
 * still keeps it, a strip of thumbnails for a batch, Download, and how long
 * is left before Higgsfield deletes it. While it is still being made, one
 * calm line says so.
 */
export default function StepPreview({ generation: g, now, retentionDays, onDownload }: StepPreviewProps) {
  const [index, setIndex] = useState(0)
  const [broken, setBroken] = useState(false)
  const [working, setWorking] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  if (isPendingGeneration(g)) {
    return (
      <p className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-accent" role="status">
        <LoaderCircle size={14} aria-hidden="true" className="flex-none animate-spin" />
        {g.status === 'queued' ? 'Waiting in Higgsfield’s queue…' : 'Higgsfield is making it…'}
      </p>
    )
  }

  const expired = isExpiredGeneration(g, now)
  if (expired) {
    return (
      <p className="inline-flex items-center gap-2 text-[12px] leading-[1.5] text-muted">
        <ImageOff size={14} aria-hidden="true" className="flex-none" />
        Deleted by Higgsfield — results are kept for {retentionDays} days.
      </p>
    )
  }

  const outputs = g.outputs
  if (g.status !== 'completed' || outputs.length === 0) return null

  const shownIndex = Math.min(index, outputs.length - 1)
  const shown = outputs[shownIndex]
  const left = msUntilExpiry(g, now)

  const download = async (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    if (working) return
    setWorking(true)
    setProblem(null)
    setProblem(await onDownload(g, shownIndex))
    setWorking(false)
  }

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="grid h-[220px] w-full grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] place-items-center overflow-hidden rounded-row border border-hair bg-bg sm:h-[260px]">
        {broken ? (
          <p className="flex max-w-[260px] flex-col items-center gap-2 px-4 text-center text-[12px] leading-[1.5] text-muted">
            <ImageOff size={20} aria-hidden="true" className="text-faint" />
            The preview did not load. Download may still work.
          </p>
        ) : shown.type === 'video' ? (
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
            alt={`Result: ${g.prompt.slice(0, 80)}`}
            loading="lazy"
            className="h-full w-full object-contain"
            onError={() => setBroken(true)}
          />
        )}
      </div>

      {outputs.length > 1 && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pictures in this step">
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
                setProblem(null)
              }}
              className={`h-11 w-11 cursor-pointer overflow-hidden rounded-[9px] border-2 bg-surface2 ${
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

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <a
          href={signedUrl(shown.download_path)}
          target="_blank"
          rel="noopener"
          onClick={(e) => void download(e)}
          className={`${LINK_PRIMARY} ${working ? 'pointer-events-none opacity-70' : ''}`}
          aria-label={`Download ${shown.type === 'video' ? 'the video' : 'the picture'}`}
        >
          <Download size={14} aria-hidden="true" />
          {working ? 'Preparing…' : 'Download'}
        </a>
        {left !== null && (
          <span
            className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${
              left < EXPIRY_WARN_MS ? 'text-red' : 'text-muted'
            }`}
          >
            <Clock size={13} aria-hidden="true" className="flex-none" />
            Deleted by Higgsfield in {fmtTimeLeft(left)}
          </span>
        )}
      </div>
      {problem && (
        <p className="text-[12px] font-semibold leading-[1.5] text-red" role="alert">
          {problem}
        </p>
      )}
    </div>
  )
}
