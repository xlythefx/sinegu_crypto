const BUBBLES = [
  { top: '60%', left: '18%', size: 70, blur: 2, duration: 8, delay: 0 },
  { top: '80%', left: '60%', size: 44, blur: 0, duration: 6.5, delay: 1.4 },
  { top: '70%', left: '38%', size: 100, blur: 4, duration: 10, delay: 0.7 },
]

/**
 * Facts, not claims. Until 2026-10-14 this row read "48.2K traders · $128M
 * profit" — placeholder numbers from the design handoff that the product has
 * never had. Anything here must be true of the product as it stands.
 */
const FACTS = [
  { value: '3', label: 'exchanges' },
  { value: '$0', label: 'to start' },
  { value: '20%', label: 'of profit only' },
]

interface Props {
  kicker: string
  title: string
  body: string
}

/**
 * The right half of the sign-in / register card. Its words change with the
 * mode — and on the register wizard with the step — and replay a short
 * reveal when they do.
 */
export default function AuthBrandPanel({ kicker, title, body }: Props) {
  return (
    <div className="relative flex flex-col justify-center overflow-hidden border-l border-border bg-[linear-gradient(155deg,var(--accentSoft),var(--surface2))] py-[52px] px-12 max-[760px]:border-l-0 max-[760px]:border-t max-[760px]:px-7 max-[760px]:py-9">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {BUBBLES.map((b, i) => (
          <div
            className="absolute rounded-full bg-[var(--glowAuth)] animate-[bubble_ease-in_infinite]"
            key={i}
            style={{
              top: b.top,
              left: b.left,
              width: b.size,
              height: b.size,
              filter: b.blur ? `blur(${b.blur}px)` : undefined,
              animationDuration: `${b.duration}s`,
              animationDelay: `${b.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="relative z-[1]">
        <div key={title} className="animate-[fadeup_0.35s_ease-out]">
          <span className="font-mono text-[11px] tracking-[0.16em] text-accent">[ {kicker} ]</span>
          <h2 className="my-3.5 font-display text-[34px] font-extrabold leading-[1.08] tracking-[-0.02em] max-[760px]:text-[28px]">
            {title}
          </h2>
          <p className="mb-7 max-w-[340px] text-[15px] leading-[1.6] text-muted">{body}</p>
        </div>
        <div className="mt-2 flex gap-6 font-mono text-[12px] text-faint">
          {FACTS.map((f) => (
            <div key={f.label}>
              <div className="font-display text-[22px] font-extrabold text-text">{f.value}</div>
              {f.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
