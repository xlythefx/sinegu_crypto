/**
 * Free template scenes and the captions — drawn on ANY 2D context (the
 * preview's <canvas> and the export worker's OffscreenCanvas run this same
 * code, so what is previewed is what is exported). Two families:
 * - pixel: an 8-bit arcade look — Press Start 2P, chunky block borders, a
 *   starfield, hard drop shadows (title card, HIGH SCORE board, LEVEL UP);
 * - clean: the brand's calm dark card with the gold accent (title, stat,
 *   disclaimer).
 * Colours are FIXED, never the theme tokens: this is a picture in a video,
 * like the P&L share card.
 *
 * The layout helpers (`wrapText`, `fitText`, `captionLayout`) are pure and
 * take a measuring function, so they are unit-tested without a canvas.
 */

import type { CaptionStyle, TemplateFields, TimelineCaption } from '../../types/creativeVideos'
import { mulberry32 } from './chiptune'
import { DISCLAIMER_TEXT } from './disclaimer'
import { CLEAN_FONT, PIXEL_FONT } from './fonts'

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

/** Width of `text` at `size` px. */
export type Measure = (text: string, size: number) => number

/* ---------- pure layout ---------- */

/** Greedy word wrap. A single word wider than the line keeps its own line. */
export function wrapText(text: string, maxWidth: number, size: number, measure: Measure): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) continue
    let line = words[0]
    for (let i = 1; i < words.length; i++) {
      const next = `${line} ${words[i]}`
      if (measure(next, size) <= maxWidth) line = next
      else {
        out.push(line)
        line = words[i]
      }
    }
    out.push(line)
  }
  return out
}

/**
 * The largest size from `maxSize` down to `minSize` at which `text` wraps
 * into at most `maxLines` lines that each fit `maxWidth`.
 */
export function fitText(
  text: string,
  maxWidth: number,
  maxLines: number,
  maxSize: number,
  minSize: number,
  measure: Measure,
): { size: number; lines: string[] } {
  const step = Math.max(1, Math.round(maxSize / 40))
  for (let size = Math.round(maxSize); size >= minSize; size -= step) {
    const lines = wrapText(text, maxWidth, size, measure)
    if (lines.length <= maxLines && lines.every((l) => measure(l, size) <= maxWidth)) return { size, lines }
  }
  return { size: minSize, lines: wrapText(text, maxWidth, minSize, measure) }
}

/** The size unit of a frame: 1 at 1080 px on the short side. */
export function unitOf(w: number, h: number): number {
  return Math.min(w, h) / 1080
}

export interface CaptionBox {
  caption: Pick<TimelineCaption, 'id' | 'text' | 'style' | 'position'>
  size: number
  lines: string[]
  /** Centre x, and the y of the box's centre. */
  x: number
  y: number
  lineHeight: number
  width: number
  height: number
}

/** Font size of a caption (before fitting), by its role. */
export function captionBaseSize(role: TimelineCaption['style'], style: CaptionStyle, w: number, h: number): number {
  const base = Math.min(w, h) * 0.058 * (style === 'pixel' ? 0.72 : 1)
  return role === 'hook' ? base * 1.2 : role === 'disclaimer' ? base * 0.55 : base
}

const CAPTION_Y: Record<TimelineCaption['position'], number> = { top: 0.15, middle: 0.5, bottom: 0.78 }

/**
 * Where each caption on screen goes: by position (top / middle / bottom,
 * clear of TikTok's own buttons at the bottom), wrapped to 86% of the width,
 * and stacked when two share a position.
 */
export function captionLayout(
  captions: ReadonlyArray<Pick<TimelineCaption, 'id' | 'text' | 'style' | 'position'>>,
  style: CaptionStyle,
  w: number,
  h: number,
  measure: Measure,
): CaptionBox[] {
  const maxWidth = w * 0.86
  const boxes: CaptionBox[] = []
  const byPos = new Map<string, CaptionBox[]>()
  for (const c of captions) {
    if (!c.text.trim()) continue
    const base = captionBaseSize(c.style, style, w, h)
    const { size, lines } = fitText(c.text.trim(), maxWidth - base * 0.8, c.style === 'disclaimer' ? 4 : 3, base, base * 0.6, measure)
    const lineHeight = size * (style === 'pixel' ? 1.45 : 1.22)
    const width = Math.min(maxWidth, Math.max(...lines.map((l) => measure(l, size))) + size * 0.9)
    const height = lines.length * lineHeight + size * 0.6
    const box: CaptionBox = { caption: c, size, lines, x: w / 2, y: h * CAPTION_Y[c.position], lineHeight, width, height }
    const group = byPos.get(c.position) ?? []
    group.push(box)
    byPos.set(c.position, group)
    boxes.push(box)
  }
  // Stack a shared position: the group is centred on its anchor.
  for (const group of byPos.values()) {
    if (group.length < 2) continue
    const gap = group[0].size * 0.3
    const total = group.reduce((s, b) => s + b.height, 0) + gap * (group.length - 1)
    let y = group[0].y - total / 2
    for (const b of group) {
      b.y = y + b.height / 2
      y += b.height + gap
    }
  }
  return boxes
}

/* ---------- drawing helpers ---------- */

function setFont(ctx: Ctx2D, size: number, family: 'pixel' | 'clean', weight = 800): void {
  ctx.font = family === 'pixel' ? `${Math.round(size)}px ${PIXEL_FONT}` : `${weight} ${Math.round(size)}px ${CLEAN_FONT}`
}

function measurer(ctx: Ctx2D, family: 'pixel' | 'clean', weight = 800): Measure {
  return (text, size) => {
    setFont(ctx, size, family, weight)
    return ctx.measureText(text).width
  }
}

function roundRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** Lines centred on (x, y), with an optional hard pixel shadow. */
function drawLines(
  ctx: Ctx2D,
  lines: string[],
  x: number,
  y: number,
  _size: number,
  lineHeight: number,
  color: string,
  shadow?: { color: string; dx: number; dy: number },
): void {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const top = y - ((lines.length - 1) * lineHeight) / 2
  lines.forEach((line, i) => {
    const ly = top + i * lineHeight
    if (shadow) {
      ctx.fillStyle = shadow.color
      ctx.fillText(line, x + shadow.dx, ly + shadow.dy)
    }
    ctx.fillStyle = color
    ctx.fillText(line, x, ly)
  })
}

/* ---------- the pixel family ---------- */

const PX = {
  bg: '#0b1030',
  bg2: '#141a4a',
  yellow: '#ffd23f',
  pink: '#ff3d6e',
  cyan: '#4de1ff',
  white: '#f4f6ff',
  orange: '#ff8a00',
}

function pixelBackground(ctx: Ctx2D, w: number, h: number, t: number): void {
  const u = unitOf(w, h)
  ctx.fillStyle = PX.bg
  ctx.fillRect(0, 0, w, h)
  // A lighter band low on the screen, in hard steps.
  const bands = 6
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = i % 2 === 0 ? PX.bg2 : PX.bg
    ctx.fillRect(0, h * (0.72 + i * 0.045), w, h * 0.045)
  }
  // A seeded starfield that twinkles.
  const rand = mulberry32(46)
  const block = Math.max(2, Math.round(6 * u))
  for (let i = 0; i < 70; i++) {
    const x = Math.floor((rand() * w) / block) * block
    const y = Math.floor((rand() * h * 0.7) / block) * block
    const phase = rand() * 6
    const on = Math.sin(t * 3 + phase) > -0.3
    if (!on) continue
    ctx.fillStyle = rand() > 0.8 ? PX.cyan : PX.white
    ctx.fillRect(x, y, block, block)
  }
  // Chunky block border.
  const b = Math.max(4, Math.round(14 * u))
  const inset = Math.round(34 * u)
  ctx.fillStyle = PX.yellow
  for (let x = inset; x < w - inset; x += b * 2) {
    ctx.fillRect(x, inset, b, b)
    ctx.fillRect(x, h - inset - b, b, b)
  }
  for (let y = inset; y < h - inset; y += b * 2) {
    ctx.fillRect(inset, y, b, b)
    ctx.fillRect(w - inset - b, y, b, b)
  }
}

function pixelText(
  ctx: Ctx2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  maxSize: number,
  color: string,
  maxLines = 2,
): number {
  if (!text.trim()) return 0
  const m = measurer(ctx, 'pixel')
  const { size, lines } = fitText(text.trim(), maxWidth, maxLines, maxSize, maxSize * 0.35, m)
  setFont(ctx, size, 'pixel')
  const lh = size * 1.4
  const shadow = Math.max(2, Math.round(size * 0.09))
  drawLines(ctx, lines, x, y, size, lh, color, { color: '#000000', dx: shadow, dy: shadow })
  return lines.length * lh
}

function drawPixelTitle(ctx: Ctx2D, f: TemplateFields, w: number, h: number, t: number): void {
  const u = unitOf(w, h)
  pixelBackground(ctx, w, h, t)
  const m = measurer(ctx, 'pixel')
  const { size, lines } = fitText((f.title || ' ').trim(), w * 0.78, 3, 100 * u, 30 * u, m)
  setFont(ctx, size, 'pixel')
  const lh = size * 1.35
  const d = Math.max(3, Math.round(size * 0.1))
  drawLines(ctx, lines, w / 2, h * 0.44, size, lh, PX.yellow, { color: PX.pink, dx: d, dy: d })
  // The subtitle blinks like an arcade attract screen.
  if (f.subtitle.trim() && Math.floor(t * 2) % 2 === 0) {
    pixelText(ctx, f.subtitle, w / 2, h * 0.44 + (lines.length * lh) / 2 + 80 * u, w * 0.78, 34 * u, PX.white)
  }
}

function drawPixelScoreboard(ctx: Ctx2D, f: TemplateFields, w: number, h: number, t: number): void {
  const u = unitOf(w, h)
  pixelBackground(ctx, w, h, t)
  // The board.
  const bw = w * 0.82
  const bh = Math.min(h * 0.5, bw * 0.85)
  const bx = (w - bw) / 2
  const by = h * 0.47 - bh / 2
  const edge = Math.max(4, Math.round(12 * u))
  ctx.fillStyle = PX.cyan
  ctx.fillRect(bx - edge, by - edge, bw + edge * 2, bh + edge * 2)
  ctx.fillStyle = '#05081c'
  ctx.fillRect(bx, by, bw, bh)
  pixelText(ctx, f.title || 'HIGH SCORE', w / 2, by + bh * 0.2, bw * 0.86, 54 * u, PX.pink, 1)
  // The figure, pulsing very slightly.
  const pulse = 1 + Math.sin(t * 5) * 0.025
  pixelText(ctx, f.value || '', w / 2, by + bh * 0.52, bw * 0.88, 150 * u * pulse, PX.yellow, 1)
  pixelText(ctx, f.subtitle, w / 2, by + bh * 0.82, bw * 0.86, 30 * u, PX.cyan, 2)
  pixelText(ctx, '1UP', bx + 60 * u, by - edge - 40 * u, 200 * u, 26 * u, PX.white, 1)
}

function drawPixelLevelUp(ctx: Ctx2D, f: TemplateFields, w: number, h: number, t: number): void {
  const u = unitOf(w, h)
  ctx.fillStyle = PX.bg
  ctx.fillRect(0, 0, w, h)
  // A burst of rays turning slowly.
  const cx = w / 2
  const cy = h * 0.46
  const r = Math.hypot(w, h)
  const rays = 14
  const turn = t * 0.5
  for (let i = 0; i < rays; i++) {
    const a0 = turn + (i * 2 * Math.PI) / rays
    const a1 = a0 + Math.PI / rays
    ctx.fillStyle = i % 2 === 0 ? PX.orange : PX.yellow
    ctx.globalAlpha = 0.28
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r)
    ctx.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r)
    ctx.closePath()
    ctx.fill()
  }
  ctx.globalAlpha = 1
  const bounce = Math.abs(Math.sin(t * 4)) * 26 * u
  const m = measurer(ctx, 'pixel')
  const { size, lines } = fitText((f.title || 'LEVEL UP!').trim(), w * 0.84, 2, 120 * u, 34 * u, m)
  setFont(ctx, size, 'pixel')
  const lh = size * 1.3
  const d = Math.max(3, Math.round(size * 0.1))
  drawLines(ctx, lines, cx, cy - bounce, size, lh, PX.yellow, { color: PX.pink, dx: d, dy: d })
  pixelText(ctx, f.subtitle, cx, cy + (lines.length * lh) / 2 + 90 * u, w * 0.8, 34 * u, PX.white)
}

/* ---------- the clean family ---------- */

const CL = {
  bg: '#0a0c11',
  bg2: '#171c27',
  gold: '#d9ad55',
  text: '#f2f4f8',
  muted: '#a3abba',
  green: '#2fd67a',
  red: '#ff5a5a',
}

function cleanBackground(ctx: Ctx2D, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, w * 0.4, h)
  g.addColorStop(0, CL.bg2)
  g.addColorStop(1, CL.bg)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  // A soft gold glow in one corner.
  const glow = ctx.createRadialGradient(w * 0.85, h * 0.1, 0, w * 0.85, h * 0.1, Math.max(w, h) * 0.6)
  glow.addColorStop(0, 'rgba(217,173,85,0.18)')
  glow.addColorStop(1, 'rgba(217,173,85,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)
}

function wordmark(ctx: Ctx2D, w: number, h: number): void {
  const u = unitOf(w, h)
  setFont(ctx, 26 * u, 'clean', 800)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = CL.gold
  ctx.fillText('P I X E L   A L P H A', w / 2, h - 90 * u)
}

function cleanText(
  ctx: Ctx2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  maxSize: number,
  color: string,
  maxLines: number,
  weight = 800,
): number {
  if (!text.trim()) return 0
  const m = measurer(ctx, 'clean', weight)
  const { size, lines } = fitText(text.trim(), maxWidth, maxLines, maxSize, maxSize * 0.4, m)
  setFont(ctx, size, 'clean', weight)
  const lh = size * 1.18
  drawLines(ctx, lines, x, y, size, lh, color)
  return lines.length * lh
}

function drawCleanTitle(ctx: Ctx2D, f: TemplateFields, w: number, h: number): void {
  const u = unitOf(w, h)
  cleanBackground(ctx, w, h)
  const used = cleanText(ctx, f.title, w / 2, h * 0.45, w * 0.82, 96 * u, CL.text, 3)
  ctx.fillStyle = CL.gold
  ctx.fillRect(w / 2 - 50 * u, h * 0.45 - used / 2 - 60 * u, 100 * u, 8 * u)
  cleanText(ctx, f.subtitle, w / 2, h * 0.45 + used / 2 + 70 * u, w * 0.78, 40 * u, CL.muted, 2, 600)
  wordmark(ctx, w, h)
}

function drawCleanStat(ctx: Ctx2D, f: TemplateFields, w: number, h: number): void {
  const u = unitOf(w, h)
  cleanBackground(ctx, w, h)
  cleanText(ctx, f.title.toUpperCase(), w / 2, h * 0.3, w * 0.8, 40 * u, CL.gold, 1, 800)
  const v = f.value.trim()
  const color = v.startsWith('+') ? CL.green : v.startsWith('-') || v.startsWith('−') ? CL.red : CL.text
  cleanText(ctx, v, w / 2, h * 0.46, w * 0.86, 210 * u, color, 1, 800)
  cleanText(ctx, f.subtitle, w / 2, h * 0.62, w * 0.8, 40 * u, CL.muted, 2, 600)
  wordmark(ctx, w, h)
}

function drawDisclaimer(ctx: Ctx2D, f: TemplateFields, w: number, h: number): void {
  const u = unitOf(w, h)
  ctx.fillStyle = CL.bg
  ctx.fillRect(0, 0, w, h)
  // The card exists for the legal line, so it is never blank: whichever field
  // holds the sentence, else the standard one.
  const text = f.title.trim() || f.subtitle.trim() || DISCLAIMER_TEXT
  cleanText(ctx, text, w / 2, h * 0.47, w * 0.78, 52 * u, CL.text, 6, 600)
  wordmark(ctx, w, h)
}

/**
 * Draw one template card filling `w × h`. `t` = seconds into the scene, for
 * the small animations (a blinking line, a pulsing figure, turning rays).
 */
export function drawTemplate(ctx: Ctx2D, f: TemplateFields, w: number, h: number, t: number): void {
  ctx.save()
  ctx.imageSmoothingEnabled = true
  switch (f.key) {
    case 'pixel-title':
      drawPixelTitle(ctx, f, w, h, t)
      break
    case 'pixel-scoreboard':
      drawPixelScoreboard(ctx, f, w, h, t)
      break
    case 'pixel-levelup':
      drawPixelLevelUp(ctx, f, w, h, t)
      break
    case 'clean-title':
      drawCleanTitle(ctx, f, w, h)
      break
    case 'clean-stat':
      drawCleanStat(ctx, f, w, h)
      break
    case 'disclaimer':
    default:
      drawDisclaimer(ctx, f, w, h)
      break
  }
  ctx.restore()
}

/** Templates of the pixel family need the pixel font before they are drawn. */
export function usesPixelFont(keys: Iterable<string>, captionStyle: CaptionStyle): boolean {
  if (captionStyle === 'pixel') return true
  for (const k of keys) if (k.startsWith('pixel-')) return true
  return false
}

/* ---------- captions ---------- */

/** Draw the captions on screen now, in the video's caption style. */
export function drawCaptions(
  ctx: Ctx2D,
  captions: ReadonlyArray<Pick<TimelineCaption, 'id' | 'text' | 'style' | 'position'>>,
  style: CaptionStyle,
  w: number,
  h: number,
): void {
  if (captions.length === 0) return
  const family = style === 'pixel' ? 'pixel' : 'clean'
  const weight = style === 'bold' ? 900 : 700
  const boxes = captionLayout(captions, style, w, h, measurer(ctx, family, weight))
  ctx.save()
  for (const b of boxes) {
    const x = b.x - b.width / 2
    const y = b.y - b.height / 2
    setFont(ctx, b.size, family, weight)
    if (style === 'bold') {
      ctx.fillStyle = 'rgba(0,0,0,0.66)'
      roundRect(ctx, x, y, b.width, b.height, b.size * 0.3)
      ctx.fill()
      drawLines(ctx, b.lines, b.x, b.y, b.size, b.lineHeight, '#ffffff')
    } else if (style === 'pixel') {
      const edge = Math.max(2, Math.round(b.size * 0.16))
      ctx.fillStyle = PX.yellow
      ctx.fillRect(x - edge, y - edge, b.width + edge * 2, b.height + edge * 2)
      ctx.fillStyle = 'rgba(11,16,48,0.94)'
      ctx.fillRect(x, y, b.width, b.height)
      drawLines(ctx, b.lines, b.x, b.y, b.size, b.lineHeight, PX.white, { color: '#000000', dx: edge * 0.6, dy: edge * 0.6 })
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.8)'
      ctx.shadowBlur = b.size * 0.35
      ctx.shadowOffsetY = b.size * 0.06
      drawLines(ctx, b.lines, b.x, b.y, b.size, b.lineHeight, '#ffffff')
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetY = 0
    }
  }
  ctx.restore()
}
