import CopyButton from '../webhooks/CopyButton'

interface ConnectorFieldProps {
  /** The field's name exactly as Grok's "Add a custom connector" form prints it. */
  label: string
  value: string
  /** Text instead of a copyable value ("Leave empty"). */
  note?: boolean
}

/**
 * One field of Grok's connector form, with what to type in it. Mono box,
 * breaks inside itself on a phone so the page never scrolls sideways.
 */
export default function ConnectorField({ label, value, note = false }: ConnectorFieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-faint">{label}</span>
      {note ? (
        <p className="rounded-row border border-dashed border-border px-3 py-2.5 text-[12.5px] text-muted">{value}</p>
      ) : (
        <div className="flex min-w-0 items-center gap-2 rounded-row border border-border bg-surface2 py-1.5 pl-3 pr-1.5">
          <code className="min-w-0 flex-1 break-all py-1 font-mono text-[12.5px] leading-[1.45] text-text">{value}</code>
          <CopyButton text={value} ariaLabel={`Copy ${label}`} />
        </div>
      )}
    </div>
  )
}
