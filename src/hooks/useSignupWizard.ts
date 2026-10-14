import { useState } from 'react'
import { ApiError } from '../services/api'
import { stepForField, stepProblem, type RegisterValues, type WizardStep } from '../lib/registerWizard'

/**
 * The state both sign-up wizards share (register page, Discord sign-up):
 * which step is on screen, every answer so far (kept when going back), the
 * one error line, and the "Continue" check. Submitting is the page's own
 * call; `fail()` turns its error into a message on the step that owns the
 * refused field — "email already taken" sends the user back to the login
 * step instead of leaving them on the last screen wondering what to fix.
 */
export function useSignupWizard(steps: readonly WizardStep[], initial: RegisterValues) {
  const [index, setIndex] = useState(0)
  const [values, setValues] = useState<RegisterValues>(initial)
  const [error, setError] = useState<string | null>(null)

  const step = steps[index]
  const isLast = index === steps.length - 1

  const set =
    <K extends keyof RegisterValues>(key: K) =>
    (value: RegisterValues[K]) =>
      setValues((prev) => ({ ...prev, [key]: value }))

  const goTo = (i: number) => {
    setError(null)
    setIndex(Math.max(0, Math.min(steps.length - 1, i)))
  }

  /**
   * Check the step on screen. On a problem, show it and stay; otherwise move
   * on — or, on the last step, return true so the caller submits.
   */
  const advance = (): boolean => {
    const problem = stepProblem(step.key, values)
    if (problem) {
      setError(problem)
      return false
    }
    setError(null)
    if (!isLast) setIndex(index + 1)
    return isLast
  }

  /** Show a failed submit on the step it belongs to. */
  const fail = (err: unknown, fallback = 'Something went wrong. Please try again.') => {
    if (!(err instanceof ApiError)) {
      setError(fallback)
      return
    }
    if (err.status === 429) {
      setError('Too many attempts. Wait a minute and try again.')
      return
    }
    const [field, messages] = Object.entries(err.errors ?? {})[0] ?? []
    const owner = field ? stepForField(field) : null
    const at = owner ? steps.findIndex((s) => s.key === owner) : -1
    if (at >= 0) setIndex(at)
    setError(messages?.[0] ?? err.message ?? fallback)
  }

  return { step, index, isLast, values, set, error, setError, advance, goTo, fail }
}
