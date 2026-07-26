import { getApiErrorMessage } from '../../services/api'

interface DataStateProps {
  loading: boolean
  error: unknown
  onRetry: () => void
  /** What's being loaded, e.g. "dashboard" — used in the copy. */
  label: string
}

/** Shared loading / error panel for data-driven dashboard pages. */
export default function DataState({
  loading,
  error,
  onRetry,
  label,
}: DataStateProps) {
  const shell =
    'rounded-card p-card border border-border bg-surface flex flex-col items-center justify-center gap-[14px] min-h-[260px] text-muted text-[14px]'

  if (loading) {
    return (
      <div className={shell}>
        <span className="w-[26px] h-[26px] rounded-full border-[3px] border-border border-t-accent animate-[dstate-spin_0.8s_linear_infinite]" />
        Loading {label}…
      </div>
    )
  }
  return (
    <div className={shell}>
      <p className="text-text max-w-[420px] text-center">
        {getApiErrorMessage(error, `Could not load the ${label}.`)}
      </p>
      <button
        type="button"
        className="border border-border bg-surface2 text-text py-[9px] px-5 rounded-pill text-[13px] font-semibold cursor-pointer hover:border-accent"
        onClick={onRetry}
      >
        Try again
      </button>
    </div>
  )
}
