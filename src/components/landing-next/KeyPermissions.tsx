import { BinanceMark } from '../ui/BrandIcons'
import PixelIcon from './PixelIcon'
import { VENUES } from './venues'
import { CONTAINER, H2, LEAD } from './layout'

interface Permission {
  /** Binance's own name for the setting (exchangeCopy.ts uses the same). */
  label: string
  on: boolean
  note: string
}

const PERMISSIONS: Permission[] = [
  { label: 'Enable Reading', on: true, note: 'So we can see your balance and positions' },
  { label: 'Enable Futures', on: true, note: 'So orders can be placed' },
  { label: 'Enable Withdrawals', on: false, note: 'Stays off. We never ask for it' },
]

/** The tick's pixels on the 10 × 10 box, two pixels tall so it reads at 20px. */
const TICK: [number, number][] = [[2, 4], [3, 5], [4, 6], [5, 5], [6, 4], [7, 3], [8, 2]]

/** A drawn checkbox: a filled square with a pixel tick, or an empty one. */
function Tick({ on }: { on: boolean }) {
  return (
    <svg width={20} height={20} viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true" className="shrink-0">
      <rect x={0.5} y={0.5} width={9} height={9} fill={on ? 'var(--green)' : 'none'} stroke={on ? 'var(--green)' : 'var(--faint)'} />
      {on && (
        <g fill="var(--bg)">
          {TICK.map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={2} />
          ))}
        </g>
      )}
    </svg>
  )
}

/**
 * "The key can trade. It can't withdraw." — the security claim shown as the
 * setting it rests on: an illustration of the key's restrictions as the
 * customer ticks them on Binance (labelled an illustration, styled in our
 * colours, never a copy of Binance's screen). Our server's IP is NOT printed:
 * the site sits behind Cloudflare and the connect page hands it out to
 * signed-in customers only.
 */
export default function KeyPermissions() {
  const open = VENUES.filter((v) => v.open)
  const soon = VENUES.filter((v) => !v.open)
  return (
    <section className="border-t border-hair bg-surface2">
      <div className={`${CONTAINER} py-20 grid grid-cols-2 gap-14 items-center max-[960px]:grid-cols-1 max-[960px]:gap-10 max-[560px]:py-14`}>
        <div data-aos="fade-up">
          <h2 className={`${H2} mb-4`}>The key can trade. It can&rsquo;t withdraw.</h2>
          <p className={`${LEAD} mb-4`}>
            You create the API key on Binance yourself and paste it into Pixel
            Alpha. Binance lets you choose what a key may do. Ours needs to read
            your account and trade futures, and nothing else.
          </p>
          <p className={`${LEAD} mb-8`}>
            Leave withdrawals off. A key without that permission cannot move
            money out of your account, whoever holds it. You can delete the key
            on Binance at any time, and our access ends that second.
          </p>

          <div className="border-t border-border pt-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-faint mb-3">Works with</p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {open.map((v) => (
                <span key={v.kind} className="inline-flex items-center gap-2 font-display text-[19px] font-bold">
                  {v.kind === 'binance' && (
                    <span className="text-[#f0b90b]">
                      <BinanceMark size={22} />
                    </span>
                  )}
                  {v.label}
                </span>
              ))}
              {soon.length > 0 && (
                <span className="text-sm text-muted">
                  {soon.map((v) => v.label).join(' and ')}: coming soon
                </span>
              )}
            </div>
          </div>
        </div>

        <figure data-aos="fade-up" data-aos-delay={100}>
          <div className="bg-surface border border-border rounded-card overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
            <div className="flex items-center justify-between gap-3 border-b border-hair py-3.5 px-5">
              <span className="inline-flex items-center gap-2 font-semibold text-[14px]">
                <span className="text-accent"><PixelIcon glyph="key" size={18} /></span>
                API key restrictions
              </span>
              <span className="font-mono text-[11px] text-faint">Pixel Alpha key</span>
            </div>
            <ul className="py-2">
              {PERMISSIONS.map((p) => (
                <li key={p.label} className="flex items-start gap-3.5 py-3 px-5">
                  <Tick on={p.on} />
                  <span className="min-w-0">
                    <span className={`block text-[15px] font-semibold ${p.on ? 'text-text' : 'text-muted'}`}>{p.label}</span>
                    <span className="block text-[13px] text-muted mt-0.5">{p.note}</span>
                  </span>
                  <span className={`ml-auto font-mono text-[11px] font-semibold ${p.on ? 'text-green' : 'text-faint'}`}>
                    {p.on ? 'ON' : 'OFF'}
                  </span>
                </li>
              ))}
            </ul>
            <div className="border-t border-hair py-3.5 px-5 flex items-start gap-3.5">
              <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-[5px] border-accent" aria-hidden="true" />
              <span className="text-[13.5px] leading-[1.55] text-muted">
                <span className="font-semibold text-text">Restrict access to trusted IPs only.</span>{' '}
                Binance asks for this before a key may trade futures. The connect
                page gives you our server&rsquo;s address to paste in.
              </span>
            </div>
          </div>
          <figcaption className="text-[12px] text-faint mt-3">
            An illustration of the settings you tick on Binance, not a screenshot.
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
