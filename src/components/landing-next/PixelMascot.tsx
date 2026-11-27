import type { CSSProperties } from 'react'

const DIR = '/assets/pixel-mascot'

/**
 * Where his parts sit, as shares of the picture (measured on the layer files,
 * which are his Creatives reference image cut out, legs shortened to sit).
 */
const VISOR: CSSProperties = { left: '23.87%', top: '19.13%', width: '52.39%', height: '9.07%' }
/** The two eye glints, as shares of the visor. */
const EYES: CSSProperties[] = [
  { left: '18.97%', width: '6.4%' },
  { left: '74.63%', width: '6.65%' },
]
const ANTENNA_TIP: CSSProperties = { left: '17.03%', top: '1.65%', width: '6.58%', height: '4.12%' }

const LAYER = 'absolute inset-0 h-full w-full select-none'

/**
 * Pixel, the robot from Admin → Creatives → Character, sitting and alive
 * (owner, 2026-11-27: "not a picture, an actual robot moving"). Three
 * pictures stacked on one canvas (legs under the body, so a kicked leg slides
 * up behind his belt) plus parts drawn here:
 * - his feet kick in turns for about a second, then rest;
 * - his eyes look left and right, and blink (the glints were painted off the
 *   body picture so these can move);
 * - his antenna light flashes on the order book's LIVE beat.
 * Every move is a whole pixel (`steps(1, end)`, keyframes in index.css), and
 * nothing moves for a visitor who asked their device for reduced motion.
 * Decorative: hidden from screen readers. The caller positions it (absolute
 * or relative): the layers fill that box. Where his seat falls is the
 * caller's business too (`PIXEL_SEAT` in HeroNext).
 */
export default function PixelMascot({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <div aria-hidden="true" className={`aspect-[264/413] pointer-events-none ${className}`} style={style}>
      <img
        src={`${DIR}/leg-left.png`}
        alt=""
        decoding="async"
        className={`${LAYER} motion-safe:animate-[pxkick_3.2s_steps(1,end)_infinite]`}
      />
      <img
        src={`${DIR}/leg-right.png`}
        alt=""
        decoding="async"
        className={`${LAYER} motion-safe:animate-[pxkick_3.2s_steps(1,end)_256ms_infinite]`}
      />
      <img src={`${DIR}/base.png`} alt="" decoding="async" className={LAYER} />
      <span
        className="absolute bg-[#151827] opacity-0 motion-safe:animate-[pxantenna_1.2s_steps(1,end)_infinite]"
        style={ANTENNA_TIP}
      />
      <span className="absolute overflow-hidden" style={VISOR}>
        <span className="absolute inset-0 motion-safe:animate-[pxlook_7s_steps(1,end)_infinite]">
          {EYES.map((eye, i) => (
            <span
              key={i}
              className="absolute top-0 h-full bg-[#fffdf6] shadow-[0_0_3px_1px_rgba(255,246,214,0.85)] motion-safe:animate-[pxeyes_4.6s_steps(1,end)_infinite]"
              style={eye}
            />
          ))}
        </span>
      </span>
    </div>
  )
}
