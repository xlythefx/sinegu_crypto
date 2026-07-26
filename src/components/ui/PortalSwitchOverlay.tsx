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
          className={`fixed inset-0 z-[1200] flex items-center justify-center bg-bg ${
            sw.leaving
              ? 'animate-[pswitch-out_0.35s_ease-in_both]'
              : 'animate-[pswitch-in_0.25s_ease-out_both]'
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-1.5 animate-[pswitch-rise_0.45s_ease-out_both]">
            <img
              className="w-[52px] h-[52px] object-contain mb-2.5 animate-[pswitch-pulse_1.4s_ease-in-out_infinite]"
              src="/assets/logo.png"
              alt=""
            />
            <div className="font-display text-[20px] font-bold text-text tracking-[0.2px]">
              SineguAlerts
            </div>
            <div className="font-mono text-[12px] font-semibold uppercase tracking-[2.5px] text-accent">
              {sw.portal}
            </div>
            <span className="w-[26px] h-[26px] mt-[22px] rounded-full border-[3px] border-border border-t-accent animate-[pswitch-spin_0.8s_linear_infinite]" />
            <div className="mt-2 text-[13px] text-muted">
              Switching workspace…
            </div>
          </div>
        </div>
      )}
    </PortalSwitchContext.Provider>
  )
}
