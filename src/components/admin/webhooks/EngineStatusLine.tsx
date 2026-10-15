import { RefreshCw } from 'lucide-react'

interface EngineStatusLineProps {
  reachable: boolean
  refreshing: boolean
  onRefresh: () => void
}

/**
 * Whether the engine answered the API just now. When it did not, every live
 * status below reads "Unknown" — the paths and addresses are config and stay
 * right either way.
 */
export default function EngineStatusLine({ reachable, refreshing, onRefresh }: EngineStatusLineProps) {
  return (
    <div
      className="mb-stack flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-card border border-border bg-surface px-card py-3.5 max-[480px]:px-3.5"
      data-aos="fade-up"
      role="status"
    >
      <span className="inline-flex items-center gap-2 text-[13px] font-bold text-text">
        <span
          className={`h-2 w-2 flex-none rounded-full ${reachable ? 'bg-green' : 'bg-red'}`}
          aria-hidden="true"
        />
        {reachable ? 'Engine answering' : 'Engine not answering'}
      </span>
      <span className="min-w-0 flex-1 basis-[240px] text-[12.5px] leading-[1.5] text-muted">
        {reachable
          ? 'Which exchanges are live and which secrets are set is read from the engine right now.'
          : 'Live status is unknown — the paths and addresses below are still right.'}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="inline-flex min-h-9 flex-none cursor-pointer items-center gap-1.5 rounded-[9px] border border-border bg-surface2 px-3 text-[12px] font-semibold text-muted transition-[border-color,color] duration-150 disabled:opacity-50 enabled:hover:border-accent enabled:hover:text-text"
      >
        <RefreshCw size={13} className={refreshing ? 'animate-spin' : undefined} aria-hidden="true" />
        Refresh
      </button>
    </div>
  )
}
