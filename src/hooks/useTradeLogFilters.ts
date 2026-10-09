import { useEffect, useMemo, useRef, useState } from 'react'
import type { TradeLogFilters, TradeLogOutcome } from '../types/tradeLogs'

export type OutcomeFilter = TradeLogOutcome | 'all'

/** How long the customer box waits for typing to stop before it searches. */
const SEARCH_DELAY_MS = 300

/**
 * Filter state for Admin → Signal Log, shared by its two views.
 *
 * Two kinds of filter, kept apart because the endpoints treat them apart:
 * - SIGNAL filters (action, ticker, dates) narrow which signals are read —
 *   both the list and the Issues view honour them;
 * - ACCOUNT filters (outcome, reason, customer) look inside each signal's
 *   fan-out — the list only.
 *
 * The page number is DERIVED from the filters it was chosen under, so any
 * filter change lands back on page 1 with no reset effect (an out-of-range
 * offset would silently return an empty page).
 */
export function useTradeLogFilters() {
  const [action, setAction] = useState('all')
  const [ticker, setTicker] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [outcome, setOutcome] = useState<OutcomeFilter>('all')
  const [reason, setReason] = useState('all')
  // What the box shows vs. what is searched: the search waits for typing to
  // stop, but emptying the box applies at once.
  const [accountInput, setAccountInputState] = useState('')
  const [account, setAccount] = useState('')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const setAccountNow = (value: string) => {
    window.clearTimeout(timer.current)
    setAccountInputState(value)
    setAccount(value.trim())
  }

  const setAccountInput = (value: string) => {
    setAccountInputState(value)
    window.clearTimeout(timer.current)
    const q = value.trim()
    if (q === '') {
      setAccount('')
      return
    }
    timer.current = window.setTimeout(() => setAccount(q), SEARCH_DELAY_MS)
  }

  const signalFilters = useMemo<TradeLogFilters>(
    () => ({ action, ticker, from, to }),
    [action, ticker, from, to],
  )
  const listFilters = useMemo<TradeLogFilters>(
    () => ({ ...signalFilters, outcome, reason, account }),
    [signalFilters, outcome, reason, account],
  )
  const signalKey = `${action}|${ticker}|${from}|${to}`
  const listKey = `${signalKey}|${outcome}|${reason}|${account}`

  const [paging, setPaging] = useState({ key: listKey, page: 1 })
  const page = paging.key === listKey ? paging.page : 1
  const setPage = (next: number) => setPaging({ key: listKey, page: next })

  const signalFiltersActive = action !== 'all' || ticker !== 'all' || from !== '' || to !== ''
  const accountFiltersActive = outcome !== 'all' || reason !== 'all' || account !== ''

  const clear = () => {
    setAction('all')
    setTicker('all')
    setFrom('')
    setTo('')
    setOutcome('all')
    setReason('all')
    setAccountNow('')
  }

  /** Narrow the list to one issue's cause (and account, when it has one). */
  const focusIssue = (reasonKey: string, accountName: string | null) => {
    setOutcome('all')
    setReason(reasonKey)
    setAccountNow(accountName ?? '')
  }

  return {
    action,
    setAction,
    ticker,
    setTicker,
    from,
    setFrom,
    to,
    setTo,
    outcome,
    setOutcome,
    reason,
    setReason,
    accountInput,
    setAccountInput,
    page,
    setPage,
    signalFilters,
    listFilters,
    signalKey,
    listKey,
    signalFiltersActive,
    accountFiltersActive,
    clear,
    focusIssue,
  }
}

export type TradeLogFilterState = ReturnType<typeof useTradeLogFilters>
