import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Camera } from 'lucide-react'
import { toPng } from 'html-to-image'
import { captureFileName, localIsoDate } from '../../lib/capture'
import { fmtMediumDate } from '../../lib/format'

interface CapturableProps {
  /** The card's own title — goes in the file name. */
  name: string
  /** Whose figures these are (e.g. the user's name) — footer + file name. */
  subject: string
  children: ReactNode
}

/** Marks nodes that must never appear in the PNG (the button, the error). */
const SKIP_ATTR = 'data-capture-skip'

/** Two frames: one for React to commit the footer, one for layout/paint. */
function nextPaint(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
}

/**
 * Force every AOS-animated node inside `root` (and `root` itself) fully
 * visible for the capture. AOS holds a card at opacity 0 / translated until it
 * is revealed, and html-to-image copies COMPUTED styles — so a card still
 * mid-reveal would come out faded or blank. Returns the undo.
 */
function forceVisible(root: HTMLElement): () => void {
  const nodes = [root, ...root.querySelectorAll<HTMLElement>('[data-aos]')]
  const saved = nodes.map((el) => ({
    el,
    opacity: el.style.opacity,
    transform: el.style.transform,
    transition: el.style.transition,
  }))
  for (const el of nodes) {
    el.style.transition = 'none'
    el.style.opacity = '1'
    el.style.transform = 'none'
  }
  return () => {
    for (const s of saved) {
      s.el.style.opacity = s.opacity
      s.el.style.transform = s.transform
      s.el.style.transition = s.transition
    }
  }
}

function download(dataUrl: string, fileName: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/**
 * Wraps one card with a "Download as PNG" camera button. The PNG is the card
 * plus a branded footer strip ("Pixel Alpha · {subject} · {date}") that only
 * exists while the capture runs, so the screen never shows it.
 *
 * Fonts come from Google Fonts; html-to-image inlines them when it can read
 * the stylesheet, and if that fails the capture is retried without embedded
 * fonts rather than failing — the image then uses the system fallbacks.
 */
export default function Capturable({ name, subject, children }: CapturableProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!capturing) return
    let cancelled = false

    const run = async () => {
      const root = rootRef.current
      if (!root) return
      await nextPaint()
      if (cancelled) return
      const restore = forceVisible(root)
      const options = {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        style: { opacity: '1', transform: 'none' },
        filter: (node: HTMLElement) =>
          !(node instanceof HTMLElement && node.hasAttribute(SKIP_ATTR)),
      }
      try {
        let dataUrl: string
        try {
          dataUrl = await toPng(root, options)
        } catch (fontError) {
          // Most often the web-font embed (a cross-origin stylesheet) —
          // an image in fallback fonts beats no image.
          console.warn('Capture with embedded fonts failed; retrying without.', fontError)
          dataUrl = await toPng(root, { ...options, skipFonts: true })
        }
        if (!cancelled) download(dataUrl, captureFileName(subject, name))
      } catch (err) {
        console.error('Card capture failed', err)
        if (!cancelled) setError('Could not create the image. Try again.')
      } finally {
        restore()
        if (!cancelled) setCapturing(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [capturing, name, subject])

  // An error is a hint, not a state — it clears itself.
  useEffect(() => {
    if (!error) return
    const t = window.setTimeout(() => setError(null), 5000)
    return () => window.clearTimeout(t)
  }, [error])

  const start = () => {
    if (capturing) return
    setError(null)
    setCapturing(true)
  }

  return (
    <div ref={rootRef} className="group/cap relative flex flex-col">
      <div className="flex flex-1 flex-col [&>*]:flex-1">{children}</div>

      {capturing && (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-row border border-border bg-surface px-4 py-2.5 font-mono text-[11.5px] text-muted">
          <span>
            <span className="font-bold text-accent">Pixel Alpha</span>
            {' · '}
            <span className="text-text">{subject}</span>
          </span>
          <span>{fmtMediumDate(localIsoDate())}</span>
        </div>
      )}

      <button
        type="button"
        {...{ [SKIP_ATTR]: '' }}
        onClick={start}
        disabled={capturing}
        aria-label="Download as PNG"
        title="Download as PNG"
        className={`absolute -right-3.5 -top-3.5 z-10 grid h-9 w-9 place-items-center rounded-full border border-border bg-surface text-muted shadow-[0_6px_18px_rgba(0,0,0,0.28)] transition-[opacity,color,border-color] duration-150 hover:border-accent-line hover:text-accent focus-visible:opacity-100 disabled:cursor-wait [@media(hover:none)]:h-10 [@media(hover:none)]:w-10 [@media(hover:none)]:opacity-100 ${
          capturing ? 'opacity-100' : 'cursor-pointer opacity-0 group-hover/cap:opacity-100'
        }`}
      >
        {capturing ? (
          <span className="h-4 w-4 rounded-full border-2 border-accent-line border-t-accent animate-spin" />
        ) : (
          <Camera size={16} strokeWidth={2} />
        )}
      </button>

      {error && (
        <p
          {...{ [SKIP_ATTR]: '' }}
          role="alert"
          className="absolute right-0 top-7 z-10 max-w-[240px] rounded-field border border-[color-mix(in_srgb,var(--red)_35%,transparent)] bg-surface px-3 py-2 text-[12px] text-red shadow-[0_6px_18px_rgba(0,0,0,0.28)]"
        >
          {error}
        </p>
      )}
    </div>
  )
}
