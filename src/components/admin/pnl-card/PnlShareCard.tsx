import { forwardRef } from 'react'
import { PNL_CARD_PERIODS, type PnlCardStats } from '../../../lib/pnlCard'
import { fmtMediumDate, fmtSignedPct } from '../../../lib/format'

/**
 * The shareable P&L card. FIXED colours, never the theme tokens — it is an
 * image posted to Telegram / X / Discord, so flipping the app to light theme
 * must not change what gets shared (same rule as the printable invoice).
 * Percentages and counts only; see lib/pnlCard.ts.
 */
const C = {
  bg: '#0a0c11',
  panel: '#11161e',
  border: '#1f2732',
  text: '#e7ecf3',
  muted: '#8b94a3',
  faint: '#5a6372',
  accent: '#d9ad55',
  onAccent: '#1b1407',
  green: '#2fd67a',
  red: '#ff5a5a',
}

const W = 380
const H = 130

function Sparkline({ curve, up }: { curve: number[]; up: boolean }) {
  const pts = curve.length > 1 ? curve : [0, 0]
  const lo = Math.min(0, ...pts)
  const hi = Math.max(0, ...pts)
  const span = hi - lo || 1
  const x = (i: number) => (i / (pts.length - 1)) * W
  const y = (v: number) => H - 8 - ((v - lo) / span) * (H - 16)
  const line = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const colour = up ? C.green : C.red
  const zero = y(0)

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="pnl-card-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colour} stopOpacity="0.28" />
          <stop offset="100%" stopColor={colour} stopOpacity="0" />
        </linearGradient>
        <pattern id="pnl-card-dots" width="16" height="16" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill={C.border} />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#pnl-card-dots)" />
      <line x1="0" x2={W} y1={zero} y2={zero} stroke={C.faint} strokeDasharray="3 4" strokeWidth="1" />
      <path d={`${line} L${W},${H} L0,${H} Z`} fill="url(#pnl-card-fill)" />
      <path d={line} fill="none" stroke={colour} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0, textAlign: 'center', padding: '10px 4px' }}>
      <div style={{ fontSize: 10.5, color: C.muted, letterSpacing: 0.3 }}>{label}</div>
      <div
        style={{
          marginTop: 4,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 15,
          fontWeight: 700,
          color: tone ?? C.text,
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
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
  const divider = <div style={{ width: 1, alignSelf: 'stretch', background: C.border }} />

  return (
    <div
      ref={ref}
      style={{
        width: 420,
        background: C.accent,
        borderRadius: 22,
        padding: 4,
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        color: C.text,
      }}
    >
      <div style={{ background: C.bg, borderRadius: 18, padding: '18px 18px 16px' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/assets/logo.png" alt="" width={38} height={38} style={{ borderRadius: 10 }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontWeight: 800, fontSize: 17 }}>
              Pixel Alpha
            </div>
            <span
              style={{
                display: 'inline-block',
                marginTop: 3,
                padding: '1px 8px',
                borderRadius: 999,
                fontSize: 10.5,
                fontWeight: 700,
                color: C.accent,
                background: 'rgba(217,173,85,0.14)',
              }}
            >
              {periodLabel}
            </span>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
            <div>{range}</div>
            <div>{venue}</div>
          </div>
        </div>

        {/* curve */}
        <div style={{ margin: '14px -4px 0' }}>
          <Sparkline curve={stats.curve} up={up} />
        </div>

        {/* result panel */}
        <div
          style={{
            marginTop: 12,
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '14px 12px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: C.muted }}>
              Return · after exchange fees
            </div>
            <div
              style={{
                marginTop: 4,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 40,
                fontWeight: 700,
                letterSpacing: -1,
                color: tone,
              }}
            >
              {r === null ? '—' : fmtSignedPct(r, 2)}
            </div>
            <div style={{ marginTop: 2, fontSize: 11.5, color: C.muted }}>
              {stats.tradingDays === 0
                ? 'No closed trades in this period'
                : `${stats.greenDays} of ${stats.tradingDays} trading day${stats.tradingDays === 1 ? '' : 's'} green`}
            </div>
          </div>
          <div style={{ display: 'flex', borderTop: `1px solid ${C.border}` }}>
            <Tile label="Win rate" value={stats.winRate === null ? '—' : `${stats.winRate.toFixed(0)}%`} />
            {divider}
            <Tile
              label="Win streak"
              value={stats.winStreak > 0 ? `🔥 ${stats.winStreak}` : '0'}
              tone={stats.winStreak > 0 ? C.accent : undefined}
            />
            {divider}
            <Tile label="Trades" value={`${stats.wins}W · ${stats.losses}L`} />
            {divider}
            <Tile
              label="Best day"
              value={stats.bestDayPct === null ? '—' : fmtSignedPct(stats.bestDayPct, 2)}
              tone={stats.bestDayPct === null ? undefined : stats.bestDayPct >= 0 ? C.green : C.red}
            />
          </div>
        </div>
      </div>

      {/* brand band */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px 10px',
          color: C.onAccent,
        }}
      >
        <div style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontWeight: 800, fontSize: 22 }}>
          pixel alpha
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, lineHeight: 1.4 }}>
          <div>Automated crypto trading</div>
          <div style={{ fontWeight: 800 }}>pixel-alpha.com</div>
        </div>
      </div>
    </div>
  )
})

export default PnlShareCard
