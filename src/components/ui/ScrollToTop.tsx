import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'

/** Scroll depth (px) past which the button appears — one viewport-ish, so it never shows on a page that fits. */
const SHOW_AFTER_PX = 480

/**
 * Floating "back to top" button, bottom-right, for long reading pages. Hidden
 * until the reader has scrolled far enough for the top to be out of reach, and
 * stays out of the pointer's way while hidden (`pointer-events-none`).
 */
export default function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      type="button"
      aria-label="Back to top"
      title="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={`fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-text shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition-[opacity,transform,color] duration-200 hover:text-accent max-[560px]:bottom-4 max-[560px]:right-4 ${
        visible
          ? 'opacity-100 translate-y-0'
          : 'pointer-events-none opacity-0 translate-y-2'
      }`}
    >
      <ArrowUp size={18} />
    </button>
  )
}
