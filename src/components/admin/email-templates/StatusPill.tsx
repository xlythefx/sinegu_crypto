const BASE =
  'inline-flex items-center flex-none rounded-pill border py-[2px] px-2 text-[10.5px] font-bold whitespace-nowrap'
const LIVE =
  'bg-[color-mix(in_srgb,var(--green)_12%,transparent)] border-[color-mix(in_srgb,var(--green)_35%,transparent)] text-green'
const DRAFT = 'bg-surface2 border-border text-muted'

/** Live = production sends it today. Draft = designed, waiting for approval. */
export function StatusPill({ live }: { live: boolean }) {
  return (
    <span
      className={`${BASE} ${live ? LIVE : DRAFT}`}
      title={live ? 'Sent by production today' : 'Designed — not sent until the wording is approved'}
    >
      {live ? 'Live' : 'Draft'}
    </span>
  )
}
