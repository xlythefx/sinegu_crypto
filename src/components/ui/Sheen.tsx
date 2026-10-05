/**
 * One diagonal sweep of light across a tile — drop it inside a
 * `relative overflow-hidden` box. Re-key it to replay the sweep (e.g. on a
 * value change). Hidden under `prefers-reduced-motion` (`.motion-sheen`).
 */
export default function Sheen({ delay = 0 }: { delay?: number }) {
  return (
    <span
      aria-hidden
      className="motion-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.10),transparent)] animate-[sheen_1.1s_ease-out_both]"
      style={{ animationDelay: `${delay}ms` }}
    />
  )
}

/**
 * A travelling highlight over a tile while its figures are being refreshed —
 * the figures stay readable underneath (never blanked to a spinner).
 */
export function Shimmer() {
  return (
    <span
      aria-hidden
      className="motion-shimmer pointer-events-none absolute inset-0 bg-[linear-gradient(100deg,transparent_30%,rgba(255,255,255,0.07)_50%,transparent_70%)] bg-[length:200%_100%] animate-[shimmer_1.3s_linear_infinite]"
    />
  )
}
