import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { countedPath } from '../../lib/visitPages'
import { recordVisit } from '../../services/visits'

/** A page must be on screen this long before it counts as seen. */
const DWELL_MS = 2000

/** Only the first ping of a page load carries the referrer. */
let entrySent = false

/**
 * The visitor counter (Admin → Visitors). Renders nothing; on every public
 * page (lib/visitPages) it waits until the page has been VISIBLE for
 * DWELL_MS, then sends one ping. A background tab, a preloaded page or a
 * visitor who leaves within two seconds sends nothing, and scanners and
 * link-preview fetchers never run this code at all — the first of the spam
 * rules. The rest live in the API (`VisitRecorder`), which also decides that
 * staff are not counted, so nothing here reads the user's role.
 *
 * StrictMode's double effect is harmless: the first run's cleanup cancels its
 * timer before it fires.
 */
export default function VisitTracker() {
  const { pathname } = useLocation()

  useEffect(() => {
    const path = countedPath(pathname)
    if (!path) return

    let timer: number | undefined
    let sent = false

    const send = () => {
      if (sent) return
      sent = true
      const params = new URLSearchParams(window.location.search)
      const entry = !entrySent
      entrySent = true
      recordVisit({
        path,
        entry,
        referrer: entry && document.referrer ? document.referrer : undefined,
        ref: params.get('ref') ?? undefined,
        utm_source: params.get('utm_source') ?? undefined,
        utm_campaign: params.get('utm_campaign') ?? undefined,
        webdriver: navigator.webdriver === true,
      })
    }

    const arm = () => {
      window.clearTimeout(timer)
      if (!sent && document.visibilityState === 'visible') {
        timer = window.setTimeout(send, DWELL_MS)
      }
    }

    arm()
    document.addEventListener('visibilitychange', arm)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', arm)
    }
  }, [pathname])

  return null
}
