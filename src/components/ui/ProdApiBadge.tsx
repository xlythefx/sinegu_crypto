import { USING_PROD_API, API_URL } from '../../services/api'

/**
 * Red corner marker shown when the dev server is pointed at the LIVE API
 * (`VITE_USE_PROD_API=1`). Same reason `webhook_tester.py` banners its prod
 * target: local and production look identical in the browser, and the mistake
 * this prevents — a delete or a settle fired at real customer data while you
 * believed you were on WAMP — is not undoable.
 *
 * Renders nothing at all otherwise, and can never appear in a deployment:
 * `USING_PROD_API` is false on any non-dev host.
 */
export default function ProdApiBadge() {
  if (!USING_PROD_API) return null

  return (
    <div
      title={API_URL}
      className="fixed bottom-3 left-3 z-[9999] flex items-center gap-2 rounded-full border border-red-400/60 bg-red-600/95 px-3 py-1.5 font-mono text-[11px] font-semibold tracking-wide text-white shadow-lg backdrop-blur-sm select-none"
    >
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-white" />
      LIVE PROD DATA
    </div>
  )
}
