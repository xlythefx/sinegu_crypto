/** Above this many entries the dots stop helping and only the number is shown. */
const MAX_DOTS = 6

/**
 * How many entries a position may stack: filled dots plus the count for a
 * short stack ("●●● 3 entries"), the count alone for a long one — a row of 40
 * dots says nothing and does not fit a card tile.
 */
export default function EntryPips({ entries }: { entries: number | null }) {
  if (entries === null) return <span className="text-[10.5px] text-faint">set a base size</span>
  const dots = entries <= MAX_DOTS ? entries : 0
  const text = `${entries} entr${entries === 1 ? 'y' : 'ies'}`
  return (
    <span className="flex min-w-0 items-center gap-1 whitespace-nowrap" title={`Up to ${text} per position`}>
      {Array.from({ length: dots }, (_, i) => (
        <span key={i} className="h-2 w-2 flex-none rounded-full bg-accent" aria-hidden="true" />
      ))}
      <span className={`truncate text-[10.5px] text-muted ${dots ? 'ml-1' : ''}`}>{text}</span>
    </span>
  )
}
