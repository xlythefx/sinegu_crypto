/**
 * The 8-bit lettering of the pixel templates and pixel captions (Press Start
 * 2P, OFL, bundled from @fontsource). Loaded on demand into whichever font
 * set draws the frame — the page's (`document.fonts`, preview) or the export
 * worker's own (`self.fonts`) — so the preview and the MP4 use the same file.
 *
 * The clean family uses the system's sans-serif in BOTH places on purpose:
 * the brand's web fonts come from Google's CSS, which a worker cannot reach,
 * and the preview must look like the export.
 */

import pixelFontUrl from '@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2?url'

export const PIXEL_FAMILY = 'Press Start 2P'
export const PIXEL_FONT = `"${PIXEL_FAMILY}", ui-monospace, monospace`
export const CLEAN_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

const loaded = new WeakMap<object, Promise<boolean>>()

/** Resolves true once the pixel font is usable in `fonts` (false = it fell back to monospace). */
export function loadPixelFont(fonts: FontFaceSet | undefined): Promise<boolean> {
  if (!fonts || typeof FontFace === 'undefined') return Promise.resolve(false)
  const hit = loaded.get(fonts)
  if (hit) return hit
  const p = (async () => {
    try {
      const face = new FontFace(PIXEL_FAMILY, `url(${pixelFontUrl})`)
      await face.load()
      fonts.add(face)
      return true
    } catch {
      return false
    }
  })()
  loaded.set(fonts, p)
  return p
}
