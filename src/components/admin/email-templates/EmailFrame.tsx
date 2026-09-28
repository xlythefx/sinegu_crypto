import { useCallback, useMemo, useRef, useState } from 'react'
import { FRAME_WIDTHS, type FrameWidth } from './constants'

/**
 * One email, drawn in an iframe so its inline styles can never leak into the
 * app (or the app's theme into it) — the email is fixed light colours, like
 * the printable invoice, whatever theme the admin is using.
 *
 * `allow-same-origin` without `allow-scripts`: the email runs no code, and the
 * frame stays readable so it can be sized to its content (no inner scrollbar).
 * Links open in a new tab via an injected <base target="_blank">.
 */
export default function EmailFrame({
  html,
  title,
  width,
}: {
  html: string
  title: string
  width: FrameWidth
}) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(900)

  const doc = useMemo(
    () => html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}<base target="_blank">`),
    [html],
  )

  const measure = useCallback(() => {
    const d = ref.current?.contentDocument
    if (d?.documentElement) setHeight(d.documentElement.scrollHeight + 4)
  }, [])

  return (
    <div className="overflow-x-auto rounded-[14px] border border-border bg-[#f4f5f7]">
      <iframe
        // Re-mount on width change so the height is measured at the new width.
        key={width}
        ref={ref}
        title={title}
        srcDoc={doc}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        onLoad={measure}
        className="block mx-auto border-0 max-w-full bg-[#f4f5f7]"
        style={{ width: FRAME_WIDTHS[width], height }}
      />
    </div>
  )
}
