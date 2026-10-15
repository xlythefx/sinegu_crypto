import { apiFetch, ApiError } from './api'
import type { ExchangeKind } from '../types/exchanges'
import type { SignalFeed } from '../types/feeds'
import type {
  EngineStatus,
  EngineTarget,
  ManualTradeInput,
  ManualTradeResult,
  ManualTradeTarget,
} from '../types/manualTrade'

/**
 * Users the engine would trade for this exchange (same filters as the
 * fan-out) on this feed — the test feed lists tester accounts only.
 */
export async function getManualTradeTargets(
  exchange: ExchangeKind,
  feed: SignalFeed = 'main',
): Promise<ManualTradeTarget[]> {
  const res = await apiFetch<{ success: boolean; targets: ManualTradeTarget[] }>(
    `/admin/manual-trade/targets?exchange=${exchange}&feed=${feed}`,
    { auth: true },
  )
  return res.targets
}

/** Probe the engine's /health through the API (the browser never calls it directly). */
export async function getEngineStatus(
  target: EngineTarget,
  exchange: ExchangeKind = 'binance',
  feed: SignalFeed = 'main',
): Promise<EngineStatus> {
  const res = await apiFetch<{ success: boolean; engine: EngineStatus }>(
    `/admin/manual-trade/engine?target=${target}&exchange=${exchange}&feed=${feed}`,
    { auth: true },
  )
  return res.engine
}

/** The API has no test-feed secret to sign a test signal with. */
export const TEST_SECRET_MISSING = 'ENGINE_TEST_WEBHOOK_SECRET_MISSING'

/**
 * Fire the signal. The API adds the webhook secret and forwards it to the
 * engine, so nothing secret ever lives in the browser. A 502 means the engine
 * refused every attempt — surface its message rather than a generic failure.
 * A test-feed send on a box with no `ENGINE_TEST_WEBHOOK_SECRET` throws a 503
 * `ENGINE_TEST_WEBHOOK_SECRET_MISSING` (see {@link TEST_SECRET_MISSING}).
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
