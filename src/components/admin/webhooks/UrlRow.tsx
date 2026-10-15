import CopyButton from './CopyButton'

interface UrlRowProps {
  /** "Production" / "Local". */
  label: string
  url: string
}

/**
 * One address, labelled, in a mono box with its copy button. The URL breaks
 * inside its own box on a narrow phone, so the page never scrolls sideways.
 */
export default function UrlRow({ label, url }: UrlRowProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-faint">
        {label}
      </span>
      <div className="flex min-w-0 items-center gap-2 rounded-row border border-border bg-surface2 py-1.5 pl-3 pr-1.5">
        <code className="min-w-0 flex-1 break-all py-1 font-mono text-[12.5px] leading-[1.45] text-text">
          {url}
        </code>
        <CopyButton text={url} ariaLabel={`Copy the ${label.toLowerCase()} address`} />
      </div>
    </div>
  )
}
