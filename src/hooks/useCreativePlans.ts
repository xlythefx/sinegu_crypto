import { useCallback, useEffect, useState } from 'react'
import { sortPlans } from '../lib/creatives'
import { getCreativePlans } from '../services/creatives'
import type { CreativePlan } from '../types/creatives'

export interface CreativePlansState {
  plans: CreativePlan[] | null
  loading: boolean
  error: unknown
  reload: () => void
  /** Put a created or saved plan in the list, in the API's order. */
  upsert: (plan: CreativePlan) => void
  remove: (id: number) => void
}

/**
 * Every content plan, kept locally after the first read so a save, a stage
 * move or a delete shows at once instead of waiting for a re-read.
 */
export function useCreativePlans(): CreativePlansState {
  const [plans, setPlans] = useState<CreativePlan[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getCreativePlans()
      .then((list) => {
        if (!cancelled) setPlans(sortPlans(list))
      })
      .catch((err) => {
        if (!cancelled) setError(err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])

  const upsert = useCallback((plan: CreativePlan) => {
    setPlans((prev) => {
      const list = prev ?? []
      const next = list.some((p) => p.id === plan.id)
        ? list.map((p) => (p.id === plan.id ? plan : p))
        : [plan, ...list]
      return sortPlans(next)
    })
  }, [])

  const remove = useCallback((id: number) => {
    setPlans((prev) => (prev ? prev.filter((p) => p.id !== id) : prev))
  }, [])

  return { plans, loading, error, reload, upsert, remove }
}
