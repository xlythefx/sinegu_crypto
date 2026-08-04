import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Eraser, RefreshCw } from 'lucide-react'
import { clearServerCaches } from '../../services/admin'
import { getApiErrorMessage } from '../../services/api'
import { CARD, NOTE_ERROR, NOTE_WARN } from './engine/classes'

const BTN =
  'inline-flex items-center gap-2 h-10 rounded-pill border border-accent-line bg-accent-soft px-[18px] text-[13px] font-bold text-accent transition-colors duration-150 hover:bg-accent hover:text-on-accent disabled:opacity-55 disabled:cursor-not-allowed'

const NOTE_OK =
  'flex items-start gap-2 rounded-row border border-[color-mix(in_srgb,var(--green)_35%,transparent)] bg-[color-mix(in_srgb,var(--green)_10%,transparent)] px-3.5 py-2.5 text-[12.5px] font-semibold text-green'

/**
 * Server-side cache flush: Laravel's config/route/view caches plus the trading
 * engine's cached account + asset lists.
 *
 * Deliberately NOT a fix for a stale browser — nginx sends index.html with
 * `Cache-Control: no-cache`, so visitors always revalidate and pick up a new
 * build on their next load. This button is for server state.
 */
export default function MaintenanceCard() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setBusy(true)
    setResult(null)
    setError(null)
    try {
      const res = await clearServerCaches()
      const parts = [`app: ${res.cleared.length} cache(s) rebuilt`]
      if (res.engine.refreshed.length > 0) {
        parts.push(`engine: ${res.engine.refreshed.join(', ')}`)
      } else if (res.engine.error) {
        parts.push(`engine: ${res.engine.error}`)
      }
      if (res.failed.length > 0) parts.push(`failed: ${res.failed.join('; ')}`)
      setResult(parts.join(' · '))
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not clear the caches.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className={`${CARD} grow basis-[320px]`}
      data-aos="fade-up"
      data-aos-delay="100"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="font-display text-[15px] font-extrabold">
            Maintenance
          </div>
          <p className="mt-1 text-[12.5px] text-muted">
            Rebuild the API's config and route caches and refresh the engine's
            account and asset lists.
          </p>
        </div>

        <button type="button" className={BTN} disabled={busy} onClick={run}>
          {busy ? (
            <RefreshCw size={15} className="animate-[dstate-spin_0.8s_linear_infinite]" />
          ) : (
            <Eraser size={15} />
          )}
          {busy ? 'Clearing…' : 'Clear caches'}
        </button>
      </div>

      {result && (
        <div className={`mt-3.5 ${NOTE_OK}`}>
          <CheckCircle2 size={15} className="flex-none mt-px" />
          <span className="break-words">{result}</span>
        </div>
      )}

      {error && (
        <div className={`mt-3.5 ${NOTE_ERROR}`}>
          <AlertTriangle size={15} className="flex-none mt-px" />
          <span className="break-words">{error}</span>
        </div>
      )}

      <p className={`mt-3.5 ${NOTE_WARN}`}>
        Visitors always get the newest build automatically — index.html is
        served no-cache, so no hard refresh or incognito is needed.
      </p>
    </section>
  )
}
