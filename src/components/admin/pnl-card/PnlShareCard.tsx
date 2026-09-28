import { forwardRef, type ReactNode } from 'react'
import { PNL_CARD_PERIODS, type PnlCardStats } from '../../../lib/pnlCard'
import { fmtMediumDate, fmtSignedPct } from '../../../lib/format'

/**
 * The shareable P&L card. FIXED colours, never the theme tokens — it is an
 * image posted to Telegram / X / Discord, so flipping the app to light theme
 * must not change what gets shared (same rule as the printable invoice).
 * Percentages and counts only; see lib/pnlCard.ts.
 *
 * The engine draws the same card for the Discord "wins" channel
 * (trading-flask/binance_abcd/win_card.py) — keep the two layouts in step.
 */
const C = {
  bg: '#0a0c11',
  panel: '#11161e',
  border: '#1f2732',
  text: '#e7ecf3',
  muted: '#8b94a3',
  faint: '#5a6372',
  accent: '#d9ad55',
  accentHi: '#f0cd7c',
  accentLo: '#b98a35',
  onAccent: '#1b1407',
  green: '#2fd67a',
  red: '#ff5a5a',
}

const MONO = "'IBM Plex Mono', monospace"
const DISPLAY = "'Bricolage Grotesque', system-ui, sans-serif"

const W = 380
const H = 112

/** '#2fd67a' + 0.2 → 'rgba(47,214,122,0.2)' */
function rgba(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

function Sparkline({ curve, colour, empty }: { curve: number[]; colour: string; empty: boolean }) {
  if (empty) {
    // Nothing closed: the grid and the zero line only — a flat line with an
    // end dot would read as a flat result, which is a different claim.
    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} aria-hidden style={{ display: 'block' }}>
        <defs>
          <pattern id="pnl-card-dots" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.9" fill={C.border} />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#pnl-card-dots)" />
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke={C.faint} strokeDasharray="3 5" strokeWidth="1" />
      </svg>
    )
  }
  const pts = curve.length > 1 ? curve : [0, 0]
  const lo = Math.min(0, ...pts)
  const hi = Math.max(0, ...pts)
  const span = hi - lo || 1
  const x = (i: number) => 6 + (i / (pts.length - 1)) * (W - 12)
  const y = (v: number) => H - 10 - ((v - lo) / span) * (H - 20)
  const line = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const zero = y(0)
  const endX = x(pts.length - 1)
  const endY = y(pts[pts.length - 1])

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} aria-hidden style={{ display: 'block' }}>
      <defs>
        <linearGradient id="pnl-card-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colour} stopOpacity="0.32" />
          <stop offset="100%" stopColor={colour} stopOpacity="0" />
        </linearGradient>
        <pattern id="pnl-card-dots" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.9" fill={C.border} />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#pnl-card-dots)" />
      <line x1="0" x2={W} y1={zero} y2={zero} stroke={C.faint} strokeDasharray="3 5" strokeWidth="1" />
      <path d={`${line} L${endX},${H} L${x(0)},${H} Z`} fill="url(#pnl-card-fill)" />
      <path d={line} fill="none" stroke={colour} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.length <= 24 &&
        pts.slice(1, -1).map((v, i) => (
          <circle key={i} cx={x(i + 1)} cy={y(v)} r="2.2" fill={C.bg} stroke={colour} strokeWidth="1.5" />
        ))}
      <circle cx={endX} cy={endY} r="9" fill={colour} opacity="0.18" />
      <circle cx={endX} cy={endY} r="4.5" fill={colour} stroke={C.bg} strokeWidth="2" />
    </svg>
  )
}

/** A thin track with the filled share, or a green/red split when `split` is given. */
function Bar({ share, colour, split }: { share?: number; colour?: string; split?: [number, number] }) {
  const track = { height: 4, borderRadius: 999, background: C.border, overflow: 'hidden', display: 'flex' }
  if (split) {
    const [w, l] = split
    const total = w + l
    return (
      <div style={track}>
        {total > 0 && <div style={{ width: `${(w / total) * 100}%`, background: C.green }} />}
        {total > 0 && <div style={{ width: `${(l / total) * 100}%`, background: C.red }} />}
      </div>
    )
  }
  return (
    <div style={track}>
      <div style={{ width: `${Math.max(0, Math.min(100, share ?? 0))}%`, background: colour ?? C.accent }} />
    </div>
  )
}

function Tile({ label, value, tone, children }: { label: string; value: ReactNode; tone?: string; children?: ReactNode }) {
  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '10px 12px',
        minWidth: 0,
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 500, color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div
        style={{
          marginTop: 4,
          fontFamily: MONO,
          fontSize: 17,
          fontWeight: 700,
          color: tone ?? C.text,
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
      {children && <div style={{ marginTop: 7 }}>{children}</div>}
    </div>
  )
}

interface PnlShareCardProps {
  stats: PnlCardStats
  /** "All exchanges" / "Binance" — which venue the figures cover. */
  venue: string
}

const PnlShareCard = forwardRef<HTMLDivElement, PnlShareCardProps>(function PnlShareCard(
  { stats, venue },
  ref,
) {
  const r = stats.returnPct
  const up = (r ?? 0) >= 0
  const tone = r === null ? C.muted : up ? C.green : C.red
  const periodLabel = PNL_CARD_PERIODS.find((p) => p.key === stats.period)?.label ?? ''
  const range =
    stats.from === stats.to
      ? fmtMediumDate(stats.to)
      : `${fmtMediumDate(stats.from)} – ${fmtMediumDate(stats.to)}`
  const sub =
    stats.tradingDays === 0
      ? 'No closed trades in this period'
      : stats.period === 'today'
        ? `${stats.trades} trade${stats.trades === 1 ? '' : 's'} closed today`
        : `${stats.greenDays} of ${stats.tradingDays} trading day${stats.tradingDays === 1 ? '' : 's'} green`

  return (
    <div
      ref={ref}
      style={{
        width: 420,
        background: `linear-gradient(160deg, ${C.accentHi} 0%, ${C.accent} 45%, ${C.accentLo} 100%)`,
        borderRadius: 24,
        padding: 4,
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        color: C.text,
      }}
    >
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 20,
          padding: '18px 18px 18px',
          background: `radial-gradient(120% 70% at 100% 0%, ${rgba(tone, 0.2)} 0%, ${rgba(tone, 0)} 60%), radial-gradient(90% 60% at 0% 100%, ${rgba(C.accent, 0.08)} 0%, ${rgba(C.accent, 0)} 70%), ${C.bg}`,
        }}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src="/assets/logo.png"
            alt=""
            width={38}
            height={38}
            style={{ borderRadius: 10, boxShadow: `0 0 0 1px ${rgba(C.accent, 0.35)}` }}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 17, lineHeight: 1.1 }}>Pixel Alpha</div>
            <span
              style={{
                display: 'inline-block',
                marginTop: 5,
                padding: '2px 9px',
                borderRadius: 999,
                fontSize: 10.5,
                fontWeight: 700,
                color: C.accent,
                background: rgba(C.accent, 0.14),
                border: `1px solid ${rgba(C.accent, 0.3)}`,
              }}
            >
              {periodLabel}
            </span>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: C.muted, lineHeight: 1.55 }}>
            <div style={{ color: C.text, fontWeight: 600 }}>{range}</div>
            <div>{venue}</div>
          </div>
        </div>

        {/* hero figure */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, letterSpacing: 1.6, color: C.muted, textTransform: 'uppercase' }}>
            Return · after exchange fees
          </div>
          <div
            style={{
              marginTop: 2,
              fontFamily: MONO,
              fontSize: 50,
              fontWeight: 700,
              letterSpacing: -1.5,
              lineHeight: 1.1,
              color: tone,
              textShadow: r === null ? 'none' : `0 0 28px ${rgba(tone, 0.35)}`,
            }}
          >
            {r === null ? '—' : fmtSignedPct(r, 2)}
          </div>
          <div style={{ marginTop: 2, fontSize: 12, color: C.muted }}>{sub}</div>
        </div>

        {/* curve */}
        <div style={{ margin: '12px -4px 0' }}>
          <Sparkline curve={stats.curve} colour={tone} empty={r === null} />
        </div>

        {/* stats */}
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Tile label="Win rate" value={stats.winRate === null ? '—' : `${stats.winRate.toFixed(0)}%`}>
            <Bar share={stats.winRate ?? 0} colour={C.green} />
          </Tile>
          <Tile
            label="Win streak"
            value={stats.winStreak > 0 ? `🔥 ${stats.winStreak}` : '0'}
            tone={stats.winStreak > 0 ? C.accent : undefined}
          >
            <div style={{ fontSize: 10.5, color: C.faint }}>trades in a row</div>
          </Tile>
          <Tile
            label="Trades"
            value={
              <span>
                <span style={{ color: stats.wins ? C.green : C.muted }}>{stats.wins}W</span>
                <span style={{ color: C.faint }}> · </span>
                <span style={{ color: stats.losses ? C.red : C.muted }}>{stats.losses}L</span>
              </span>
            }
          >
            <Bar split={[stats.wins, stats.losses]} />
          </Tile>
          <Tile
            label="Best day"
            value={stats.bestDayPct === null ? '—' : fmtSignedPct(stats.bestDayPct, 2)}
            tone={stats.bestDayPct === null ? undefined : stats.bestDayPct >= 0 ? C.green : C.red}
          >
            <div style={{ fontSize: 10.5, color: C.faint }}>
              {stats.tradingDays} trading day{stats.tradingDays === 1 ? '' : 's'}
            </div>
          </Tile>
        </div>
      </div>

      {/* brand band */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '11px 16px 9px',
          color: C.onAccent,
        }}
      >
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 22, letterSpacing: -0.3 }}>pixel alpha</div>
        <div style={{ textAlign: 'right', fontSize: 11, lineHeight: 1.4 }}>
          <div>Automated crypto trading</div>
          <div style={{ fontWeight: 800 }}>pixel-alpha.com</div>
        </div>
      </div>
    </div>
  )
})

export default PnlShareCard
