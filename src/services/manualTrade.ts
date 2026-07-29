import { apiFetch, ApiError } from './api'
import type { ExchangeKind } from '../types/exchanges'
import type {
  EngineStatus,
  EngineTarget,
  ManualTradeInput,
  ManualTradeResult,
  ManualTradeTarget,
} from '../types/manualTrade'

/** Users the engine would trade for this exchange (same filters as the fan-out). */
export async function getManualTradeTargets(
  exchange: ExchangeKind,
): Promise<ManualTradeTarget[]> {
  const res = await apiFetch<{ success: boolean; targets: ManualTradeTarget[] }>(
    `/admin/manual-trade/targets?exchange=${exchange}`,
    { auth: true },
  )
  return res.targets
}

/** Probe the engine's /health through the API (the browser never calls it directly). */
export async function getEngineStatus(
  target: EngineTarget,
): Promise<EngineStatus> {
  const res = await apiFetch<{ success: boolean; engine: EngineStatus }>(
    `/admin/manual-trade/engine?target=${target}`,
    { auth: true },
  )
  return res.engine
}

/**
 * Fire the signal. The API adds the webhook secret and forwards it to the
 * engine, so nothing secret ever lives in the browser. A 502 means the engine
 * refused every attempt — surface its message rather than a generic failure.
 */
export async function sendManualTrade(
  input: ManualTradeInput,
): Promise<ManualTradeResult> {
  try {
    return await apiFetch<ManualTradeResult>('/admin/manual-trade/send', {
      method: 'POST',
      body: input,
      auth: true,
    })
  } catch (err) {
    if (err instanceof ApiError && err.status === 502 && err.payload) {
      return err.payload as ManualTradeResult
    }
    throw err
  }
}
