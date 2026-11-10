import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { isPanelKey, panelFromTab, type CreativesPanelKey } from '../lib/creativesAgent'

export interface CreativesPanelState {
  /** The open panel, or null = just the chat. */
  panel: CreativesPanelKey | null
  /** Plans only: the wide overlay with the whole board. */
  wide: boolean
  /**
   * `?plan=` — on Plans, the plan whose editor should open (a chip in the
   * chat); on Gallery, the plan "Make it yourself" starts with.
   */
  planId: number | null
  /** Gallery only: start with "Make it yourself" open (`?make=1`). */
  makeOpen: boolean
  open: (panel: CreativesPanelKey, extra?: { plan?: number; make?: boolean }) => void
  close: () => void
  toggle: (panel: CreativesPanelKey) => void
  setWide: (wide: boolean) => void
  /** Forget `?plan=` once the plan it named was opened. */
  clearPlan: () => void
}

/** The params a panel owns; switching panels starts them afresh. */
const PANEL_PARAMS = ['panel', 'plan', 'view', 'make'] as const

/**
 * Admin → Creatives' open panel, in the URL (`?panel=plans|gallery|pixel|
 * brief|memory|budget`), so a reload or a pasted link lands on the same view.
 * The page used to have tabs: an old `?tab=planner|studio|character|budget`
 * opens the matching panel and is rewritten once, keeping its `?plan=`.
 * Every write REPLACES the history entry — opening a panel is not navigation.
 * Other params (the Planner's filters) are never touched.
 */
export function useCreativesPanel(): CreativesPanelState {
  const [params, setParams] = useSearchParams()
  const legacy = panelFromTab(params.get('tab'))

  useEffect(() => {
    if (!params.has('tab')) return
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        const mapped = panelFromTab(next.get('tab'))
        next.delete('tab')
        if (mapped) next.set('panel', mapped)
        return next
      },
      { replace: true },
    )
  }, [params, setParams])

  const raw = params.get('panel')
  const panel: CreativesPanelKey | null = isPanelKey(raw) ? raw : legacy
  const wide = panel === 'plans' && params.get('view') === 'wide'
  const planNum = Number(params.get('plan'))
  const planId = Number.isInteger(planNum) && planNum > 0 ? planNum : null

  const write = useCallback(
    (fn: (next: URLSearchParams) => void) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          fn(next)
          return next
        },
        { replace: true },
      ),
    [setParams],
  )

  const open = useCallback(
    (next: CreativesPanelKey, extra: { plan?: number; make?: boolean } = {}) =>
      write((q) => {
        for (const k of PANEL_PARAMS) q.delete(k)
        q.delete('tab')
        q.set('panel', next)
        if (extra.plan) q.set('plan', String(extra.plan))
        if (extra.make) q.set('make', '1')
      }),
    [write],
  )

  const close = useCallback(
    () =>
      write((q) => {
        for (const k of PANEL_PARAMS) q.delete(k)
        q.delete('tab')
      }),
    [write],
  )

  const toggle = useCallback(
    (key: CreativesPanelKey) => (panel === key ? close() : open(key)),
    [panel, open, close],
  )

  const setWide = useCallback(
    (on: boolean) =>
      write((q) => {
        if (on) q.set('view', 'wide')
        else q.delete('view')
      }),
    [write],
  )

  const clearPlan = useCallback(() => write((q) => q.delete('plan')), [write])

  return { panel, wide, planId, makeOpen: params.get('make') === '1', open, close, toggle, setWide, clearPlan }
}
