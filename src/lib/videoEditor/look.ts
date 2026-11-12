/**
 * The optional "Pixel look" — a global 8-bit filter, the same in the preview
 * and the export: pixelate (draw the frame small, then scale it back up with
 * smoothing OFF, so every block is one flat colour) and scanlines (thin dark
 * rows, like an arcade screen). Pixelation applies to the generated clips;
 * template cards are already drawn for their family and stay crisp. The
 * scanlines lie over the whole picture. Captions are drawn after both.
 */

import type { TimelineLook } from '../../types/creativeVideos'
import type { Ctx2D } from './templates'

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas

export type CanvasFactory = (w: number, h: number) => AnyCanvas

/** An OffscreenCanvas where there is one (workers, modern browsers), else a DOM canvas. */
export const defaultCanvasFactory: CanvasFactory = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

export function lookIsOn(look: TimelineLook): boolean {
  return look.pixel_size > 0 || look.scanlines
}

/** The block size in THIS canvas's pixels: `pixel_size` is set for the export's 1080-px short side. */
export function blockPx(look: TimelineLook, w: number, h: number): number {
  if (look.pixel_size <= 0) return 0
  return Math.max(1, (look.pixel_size * Math.min(w, h)) / 1080)
}

export class LookRenderer {
  private scratch: AnyCanvas | null = null
  private scratchCtx: Ctx2D | null = null
  private readonly make: CanvasFactory

  constructor(make: CanvasFactory = defaultCanvasFactory) {
    this.make = make
  }

  /** Pixelate what is already on `ctx` (its whole `w × h`), in place. */
  pixelate(ctx: Ctx2D, w: number, h: number, block: number): void {
    if (block <= 1) return
    const sw = Math.max(1, Math.ceil(w / block))
    const sh = Math.max(1, Math.ceil(h / block))
    if (!this.scratch || this.scratch.width !== sw || this.scratch.height !== sh) {
      this.scratch = this.make(sw, sh)
      this.scratchCtx = this.scratch.getContext('2d') as Ctx2D | null
    }
    const s = this.scratchCtx
    if (!s) return
    s.imageSmoothingEnabled = true
    s.clearRect(0, 0, sw, sh)
    s.drawImage(ctx.canvas, 0, 0, w, h, 0, 0, sw, sh)
    ctx.save()
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(this.scratch, 0, 0, sw, sh, 0, 0, sw * block, sh * block)
    ctx.restore()
  }
}

/** Dark rows across the whole frame, every other line at the frame's scale. */
export function drawScanlines(ctx: Ctx2D, w: number, h: number): void {
  const th = Math.max(1, Math.round(Math.min(w, h) / 360))
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.beginPath()
  for (let y = 0; y < h; y += th * 2) ctx.rect(0, y, w, th)
  ctx.fill()
  ctx.restore()
}

/** Draw `source` (a video frame) to fill `w × h`, cropped to keep its shape. */
export function drawCover(ctx: Ctx2D, source: CanvasImageSource, sw: number, sh: number, w: number, h: number): void {
  if (sw <= 0 || sh <= 0) return
  const scale = Math.max(w / sw, h / sh)
  const dw = sw * scale
  const dh = sh * scale
  ctx.drawImage(source, (w - dw) / 2, (h - dh) / 2, dw, dh)
}
