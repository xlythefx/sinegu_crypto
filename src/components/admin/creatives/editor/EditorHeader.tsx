import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, Download, Ellipsis, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AdminMenuButton, AdminTopBarEnd } from '../../AdminLayout'
import { PLATFORM_LABEL } from '../../../../lib/creatives'
import { fmtSeconds } from '../../../../lib/creativeVideos'
import type { CreativeVideo } from '../../../../types/creativeVideos'
import TonePill from '../TonePill'

interface EditorHeaderProps {
  video: CreativeVideo
  totalMs: number
  /** Platform and shape are fixed once a clip has been made. */
  locked: boolean
  onTitle: (title: string) => void
  /** "Saved" / "Saving…" / "Not saved". */
  saveState: ReactNode
  onExport: () => void
  /** A phone: export needs a computer. */
  narrow: boolean
  onDelete: () => void
  deleteDisabled: boolean
}

const EXPORT_BTN =
  'inline-flex h-9 flex-none cursor-pointer items-center justify-center gap-1.5 rounded-field border border-transparent bg-accent px-3.5 text-[12.5px] font-extrabold text-on-accent shadow-[0_8px_20px_var(--glow)] transition-[filter,opacity] duration-150 hover:brightness-[1.06] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none'
const SQUARE =
  'inline-flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-field border border-border bg-surface text-muted no-underline transition-[border-color,background,color] duration-150 hover:border-accent-line hover:bg-accent-soft hover:text-accent'

/** "⋯": the project's rarely used actions (Delete, which asks first). */
function OverflowMenu({ onDelete, deleteDisabled }: { onDelete: () => void; deleteDisabled: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div ref={ref} className="relative flex-none">
      <button type="button" className={SQUARE} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="More actions">
        <Ellipsis size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-50 flex w-[210px] flex-col rounded-row border border-border bg-surface p-1.5 shadow-[0_18px_44px_rgba(0,0,0,0.3)] animate-[fadeup_0.2s_ease-out]"
        >
          <button
            type="button"
            role="menuitem"
            disabled={deleteDisabled}
            onClick={() => {
              setOpen(false)
              onDelete()
            }}
            className="flex min-h-9 cursor-pointer items-center gap-2 rounded-[8px] px-2.5 text-left text-[12.5px] font-bold text-red transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--red)_10%,transparent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 size={14} aria-hidden="true" />
            Delete project…
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * The editor's ONE header line: back · the title (edited in place) · the
 * platform, shape, style, status and length · saved state · Export MP4 ·
 * "⋯" (Delete) · theme and avatar. It replaces the admin top bar on this
 * page, so the editor gets the screen's height. Wraps on a phone.
 */
export default function EditorHeader({
  video,
  totalMs,
  locked,
  onTitle,
  saveState,
  onExport,
  narrow,
  onDelete,
  deleteDisabled,
}: EditorHeaderProps) {
  return (
    <header className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2 animate-[fadeup_0.35s_ease-out]">
      <AdminMenuButton />
      <Link to="/admin/creatives?panel=videos" className={SQUARE} aria-label="Back to video projects" title="Video projects">
        <ArrowLeft size={16} aria-hidden="true" />
      </Link>
      <input
        value={video.title}
        maxLength={160}
        onChange={(e) => onTitle(e.target.value)}
        aria-label="Title"
        className="h-9 min-w-[150px] flex-1 basis-[180px] rounded-field border border-transparent bg-transparent px-1.5 font-display text-[17px] font-extrabold tracking-[-0.01em] text-text outline-none transition-[border-color,background] duration-150 hover:border-border focus:border-accent-line focus:bg-surface"
      />
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 max-sm:order-last max-sm:w-full">
        <TonePill tone="muted">{PLATFORM_LABEL[video.platform] ?? video.platform}</TonePill>
        <TonePill tone="muted" title={locked ? 'Fixed once a clip has been made' : undefined}>
          {video.aspect}
        </TonePill>
        <TonePill tone={video.style ? 'accent' : 'muted'}>{video.style ? video.style.name : 'No style'}</TonePill>
        {video.status === 'exported' && <TonePill tone="green">Exported</TonePill>}
        <span className="font-mono text-[11px] tabular-nums text-faint">
          {fmtSeconds(totalMs)} / {video.max_seconds} s
        </span>
        <span className="ml-1">{saveState}</span>
      </div>
      <button
        type="button"
        className={EXPORT_BTN}
        onClick={onExport}
        disabled={narrow || video.scenes.length === 0}
        title={narrow ? 'Export needs a computer' : undefined}
      >
        <Download size={14} aria-hidden="true" />
        Export MP4
      </button>
      <OverflowMenu onDelete={onDelete} deleteDisabled={deleteDisabled} />
      <AdminTopBarEnd className="ml-auto flex flex-none items-center gap-2 sm:ml-0" />
    </header>
  )
}
