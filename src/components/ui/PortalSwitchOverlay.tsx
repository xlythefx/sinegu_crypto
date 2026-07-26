import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import './PortalSwitchOverlay.css'

interface SwitchState {
  /** Route to navigate to while the overlay covers the screen. */
  to: string
  /** Portal name shown in the copy, e.g. "Admin Portal". */
  portal: string
  /** True once the fade-out has started. */
  leaving: boolean
}

type BeginSwitch = (to: string, portal: string) => void

const PortalSwitchContext = createContext<BeginSwitch>(() => {})

/** Trigger a portal switch: shows the loading screen, then navigates under it. */
export function usePortalSwitch() {
  return useContext(PortalSwitchContext)
}

/**
 * App-level provider for the admin ↔ trader portal transition. Lives above the
 * routes so the overlay survives the navigation instead of unmounting with the
 * sidebar that triggered it. Sequence: fade in → navigate at 900ms (covered) →
 * hold → fade out → unmount.
 */
export function PortalSwitchProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [sw, setSw] = useState<SwitchState | null>(null)
  const timers = useRef<number[]>([])

  const begin = useCallback<BeginSwitch>((to, portal) => {
    setSw((current) => (current ? current : { to, portal, leaving: false }))
  }, [])

  useEffect(() => {
    if (!sw || sw.leaving) return
    timers.current = [
      window.setTimeout(() => navigate(sw.to), 900),
      window.setTimeout(() => setSw((s) => (s ? { ...s, leaving: true } : s)), 1500),
      window.setTimeout(() => setSw(null), 1850),
    ]
    return () => timers.current.forEach(window.clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sw?.to])

  return (
    <PortalSwitchContext.Provider value={begin}>
      {children}
      {sw && (
        <div
          className={`pswitch${sw.leaving ? ' pswitch--leaving' : ''}`}
          role="status"
          aria-live="polite"
        >
          <div className="pswitch__inner">
            <img className="pswitch__logo" src="/assets/logo.png" alt="" />
            <div className="pswitch__title">SineguAlerts</div>
            <div className="pswitch__portal">{sw.portal}</div>
            <span className="pswitch__spinner" />
            <div className="pswitch__caption">Switching workspace…</div>
          </div>
        </div>
      )}
    </PortalSwitchContext.Provider>
  )
}
