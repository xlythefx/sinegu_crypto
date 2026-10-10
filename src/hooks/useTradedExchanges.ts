import { useMemo } from 'react'
import { useApiData } from './useApiData'
import { getEngineStatus } from '../services/admin'
import { exchangeFromBroker } from '../components/exchanges/meta'
import type { ExchangeKind } from '../types/exchanges'

/**
 * The venues the engine is trading right now, read off its `/health`
 * (`GET /admin/engine/status` → `health.exchanges`). Switching a venue on is
 * a config change on the box, never a deploy, so this is asked rather than
 * written into the client.
 *
 * null = unknown (still loading, engine silent, request refused, or an engine
 * too old to say). Callers must treat unknown as "say nothing", never as
 * "trades nothing".
 */
export function useTradedExchanges(): ReadonlySet<ExchangeKind> | null {
  const { data } = useApiData(getEngineStatus)
  const venues = data?.health?.exchanges

  return useMemo(() => {
    if (!venues || typeof venues !== 'object') return null
    const kinds = Object.keys(venues)
      .map((name) => exchangeFromBroker(name))
      .filter((k): k is ExchangeKind => k !== null)
    return new Set(kinds)
  }, [venues])
}
