import { useCallback, useRef, useState } from 'react'
import { useInterval } from './useInterval'
import { errorBudget } from '../lib/creatives'
import { creativeAiErrorMessage } from '../lib/creativesAi'
import type { CreativeBudget } from '../types/creatives'

export interface CreativeAiCall<I, R> {
  /** A call is in flight — every trigger stays disabled until it lands. */
  busy: boolean
  /** Whole seconds since the call started (0 when idle). */
  elapsed: number
  /** The plain sentence for the last failure, or null. */
  error: string | null
  result: R | null
  /** Goes up with every answer — a key that replays the reveal when a new one lands. */
  seq: number
  /** Start a call; resolves with the result, or null on failure / while one is already running. */
  run: (input: I) => Promise<R | null>
  /** Forget the result and the error. A call still in flight is ignored when it lands. */
  reset: () => void
}

interface Options {
  /** Every AI answer (and BUDGET_EXCEEDED) carries the month's budget — hand it to the page. */
  onBudget?: (budget: CreativeBudget) => void
  /** The sentence when the failure says nothing better. */
  fallback: string
}

/**
 * One Claude request at a time (a draft, an idea list): 10–40 s of waiting
 * with a ticking counter, a ref guard so a fast double-click cannot send two
 * paid calls, and a token so an answer that lands after `reset` (the modal
 * closed, another plan opened) never fills the wrong form. The budget an
 * answer carries is always passed on — the cents were spent either way.
 */
export function useCreativeAiCall<I, R extends { budget: CreativeBudget }>(
  fn: (input: I) => Promise<R>,
  { onBudget, fallback }: Options,
): CreativeAiCall<I, R> {
  const [busy, setBusy] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<R | null>(null)
  const [seq, setSeq] = useState(0)
  const inFlight = useRef(false)
  const token = useRef(0)
  const startedAt = useRef(0)
  const budgetRef = useRef(onBudget)
  budgetRef.current = onBudget

  useInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), busy ? 1000 : null)

  const run = useCallback(
    async (input: I): Promise<R | null> => {
      if (inFlight.current) return null
      inFlight.current = true
      const mine = ++token.current
      startedAt.current = Date.now()
      setElapsed(0)
      setBusy(true)
      setError(null)
      try {
        const answer = await fn(input)
        budgetRef.current?.(answer.budget)
        if (mine !== token.current) return null
        setResult(answer)
        setSeq((n) => n + 1)
        return answer
      } catch (err) {
        const b = errorBudget(err)
        if (b) budgetRef.current?.(b)
        if (mine === token.current) setError(creativeAiErrorMessage(err, fallback))
        return null
      } finally {
        if (mine === token.current) {
          inFlight.current = false
          setBusy(false)
        }
      }
    },
    [fn, fallback],
  )

  const reset = useCallback(() => {
    token.current += 1
    inFlight.current = false
    setBusy(false)
    setElapsed(0)
    setError(null)
    setResult(null)
  }, [])

  return { busy, elapsed, error, result, seq, run, reset }
}
