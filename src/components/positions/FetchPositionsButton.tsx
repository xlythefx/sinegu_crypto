import { useEffect, useState } from 'react'
import { Check, RefreshCw } from 'lucide-react'
import { refreshMyPositions } from '../../services/dashboard'
import { ApiError } from '../../services/api'

const BTN =
  'flex items-center gap-1.5 h-9 px-3 border border-border rounded-field bg-surface text-text text-[12.5px] font-semibold cursor-pointer font-body hover:border-accent-line hover:bg-accent-soft disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-surface'

/** Matches PositionRefreshController::COOLDOWN on the API. */
const COOLDOWN_SECONDS = 15

type FetchState = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done' }

interface FetchPositionsButtonProps {
  /** Re-read the page's figures — the engine has just written fresh rows. */
  onFetched: () => void
  /** A failure the page shows in its notice strip; null clears it. */
  onError: (message: string | null) => void
}

/**
 * A tester's "Fetch" on /dashboard/positions: asks the engine to read this
 * account's positions and balance from the exchange NOW, so a test signal's
 * position shows without waiting up to 5 minutes for the poller. Rendered for
 * testers only; the API refuses every other role.
 */
export default function FetchPositionsButton({ onFetched, onError }: FetchPositionsButtonProps) {
  const [state, setState] = useState<FetchState>({ kind: 'idle' })
  const [wait, setWait] = useState(0)

  // One tick per second while the cooldown runs; "Fetched" reverts to "Fetch"
  // as the countdown ends.
  useEffect(() => {
    if (wait <= 0) return
    const id = window.setTimeout(() => setWait((s) => s - 1), 1000)
    return () => window.clearTimeout(id)
  }, [wait])

  useEffect(() => {
    if (wait === 0 && state.kind === 'done') setState({ kind: 'idle' })
  }, [wait, state.kind])

  const fetchNow = async () => {
    setState({ kind: 'busy' })
    onError(null)
    try {
      const { accounts } = await refreshMyPositions()
      if (accounts === 0) {
        onError('No connected exchange account to fetch from.')
        setState({ kind: 'idle' })
        return
      }
      setState({ kind: 'done' })
      setWait(COOLDOWN_SECONDS)
      onFetched()
    } catch (err) {
      setState({ kind: 'idle' })
      if (err instanceof ApiError && err.errorCode === 'REFRESH_COOLDOWN') {
        const retry = (err.payload as { retry_after?: number } | undefined)?.retry_after
        setWait(retry && retry > 0 ? retry : COOLDOWN_SECONDS)
        return
      }
      onError(err instanceof Error && err.message ? err.message : 'Could not fetch positions.')
    }
  }

  const busy = state.kind === 'busy'
  // "Fetched" for the first few seconds, then the countdown to the next press.
  const justDone = state.kind === 'done' && wait > COOLDOWN_SECONDS - 3
  const label = busy
    ? 'Fetching…'
    : justDone
      ? 'Fetched'
      : wait > 0
        ? `Fetch (${wait}s)`
        : 'Fetch'

  return (
    <button
      type="button"
      className={BTN}
      onClick={fetchNow}
      disabled={busy || wait > 0}
      title="Read your positions and balance from the exchange now"
      aria-live="polite"
    >
      {justDone ? (
        <Check size={14} className="text-green" />
      ) : (
        <RefreshCw size={14} className={busy ? 'animate-spin' : undefined} />
      )}
      {label}
    </button>
  )
}
