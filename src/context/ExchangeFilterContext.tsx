import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import type { ExchangeKind } from '../types/exchanges'
import { EXCHANGE_META } from '../components/exchanges/meta'

/** 'all' pools every connected exchange; a venue narrows every read to it. */
export type ExchangeFilter = 'all' | ExchangeKind

const STORAGE_KEY = 'pixel-alpha-exchange-filter'

const ExchangeFilterContext = createContext<{
  exchange: ExchangeFilter
  setExchange: (next: ExchangeFilter) => void
}>({ exchange: 'all', setExchange: () => {} })

function readStored(): ExchangeFilter {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'all') return 'all'
    // A venue that has since been switched off (or a stale value) falls back
    // to "all" rather than pinning the dashboard to an empty view.
    if (raw && raw in EXCHANGE_META && EXCHANGE_META[raw as ExchangeKind].available) {
      return raw as ExchangeKind
    }
  } catch {
    /* storage unavailable — session-only */
  }
  return 'all'
}

/**
 * The top-bar exchange pills as SHARED state. Every dashboard page mounts its
 * own DashboardLayout, so the choice lives in localStorage and is re-read on
 * mount — switching to MEXC on the dashboard keeps MEXC on Positions.
 *
 * What the value means is decided server-side: pages pass it as `?exchange=`
 * and the API reads that venue's own `{exchange}_*` tables (or pools all of
 * them for 'all'). The pills never filter client-side, so a MEXC view can
 * never be Binance rows with the label swapped.
 */
export function ExchangeFilterProvider({ children }: { children: ReactNode }) {
  const [exchange, setState] = useState<ExchangeFilter>(readStored)

  const setExchange = useCallback((next: ExchangeFilter) => {
    setState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* session-only */
    }
  }, [])

  return (
    <ExchangeFilterContext.Provider value={{ exchange, setExchange }}>
      {children}
    </ExchangeFilterContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useExchangeFilter() {
  return useContext(ExchangeFilterContext)
}

/** Query-string suffix for a service call: '' for all, '?exchange=mexc' for a venue. */
// eslint-disable-next-line react-refresh/only-export-components
export function exchangeQuery(exchange: ExchangeFilter | undefined): string {
  return exchange && exchange !== 'all' ? `?exchange=${exchange}` : ''
}
