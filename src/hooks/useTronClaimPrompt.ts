import { useCallback, useEffect, useState } from 'react'
import { getTronIntentStatus } from '../services/payments'
import type { TronClaimPrompt } from '../types/payments'

/**
 * Whether a HELD crypto payment could be this invoice's — read once when the
 * invoice page opens, so a customer who closed the pay sheet (or paid after
 * their timer ran out) is still asked for the transaction ID. The pay sheet
 * itself polls the same answer while it is open.
 *
 * Silent on failure: the prompt is a convenience, and the payment is never
 * lost without it (an admin can always place it).
 */
export function useTronClaimPrompt(invoiceId: string | undefined, enabled: boolean) {
  const [prompt, setPrompt] = useState<TronClaimPrompt | null>(null)

  const refresh = useCallback(() => {
    if (!invoiceId || !enabled) {
      setPrompt(null)
      return () => {}
    }
    let cancelled = false
    getTronIntentStatus(invoiceId)
      .then((s) => {
        if (!cancelled) setPrompt(s.invoiceStatus === 'paid' ? null : s.claim)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [invoiceId, enabled])

  useEffect(() => refresh(), [refresh])

  return { prompt, setPrompt, refresh }
}
