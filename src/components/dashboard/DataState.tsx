import { getApiErrorMessage } from '../../services/api'
import './DataState.css'

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
  if (loading) {
    return (
      <div className="dstate rounded-card p-card border border-border bg-surface">
        <span className="dstate__spinner" />
        Loading {label}…
      </div>
    )
  }
  return (
    <div className="dstate rounded-card p-card border border-border bg-surface">
      <p className="dstate__error">
        {getApiErrorMessage(error, `Could not load the ${label}.`)}
      </p>
      <button type="button" className="dstate__retry" onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}
