import { useEffect, useRef, useState } from 'react'
import { exportSize } from '../../../../lib/creativeVideos'
import { loadPixelFont } from '../../../../lib/videoEditor/fonts'
import { drawTemplate, type Ctx2D } from '../../../../lib/videoEditor/templates'
import type { TemplateFields, VideoAspect } from '../../../../types/creativeVideos'

interface TemplateCanvasProps {
  fields: TemplateFields
  aspect: VideoAspect
  /** Play the card's small animation (blinking line, pulsing figure). */
  animate?: boolean
  className?: string
}

/**
 * A template card drawn with the export's own code, at the canvas's on-screen
 * size — the editor's thumbnails and the template form's preview.
 */
export default function TemplateCanvas({ fields, aspect, animate = false, className = '' }: TemplateCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [fontReady, setFontReady] = useState(false)

  useEffect(() => {
    if (!fields.key.startsWith('pixel-')) return
    let alive = true
    void loadPixelFont(document.fonts).then(() => alive && setFontReady(true))
    return () => {
      alive = false
    }
  }, [fields.key])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const { width: ew, height: eh } = exportSize(aspect)
    const draw = (t: number) => {
      const box = canvas.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = Math.max(16, Math.min(ew, Math.round(box.width * dpr)))
      const h = Math.max(16, Math.round((w * eh) / ew))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      const ctx = canvas.getContext('2d') as Ctx2D | null
      if (ctx) drawTemplate(ctx, fields, w, h, t)
    }
    if (!animate) {
      draw(0.2)
      return
    }
    let raf = 0
    const start = performance.now()
    const loop = (now: number) => {
      draw((now - start) / 1000)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [fields, aspect, animate, fontReady])

  return <canvas ref={ref} className={`block h-full w-full ${className}`} aria-hidden="true" />
}
