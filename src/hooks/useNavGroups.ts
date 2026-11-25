import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Which sidebar groups are open (admin sidebar, 2026-11-25).
 *
 * A group is open when it holds the current page, when it was opened by a
 * click / tap (remembered on this device), or while the mouse has rested on
 * it. Hover-opened groups stay open until the pointer LEAVES THE SIDEBAR,
 * never when it merely moves to the next group: closing the group above the
 * cursor would pull everything below it upward, and the row under the
 * pointer would jump. Groups only ever grow below the cursor.
 */

const STORAGE_KEY = 'pixel-alpha.admin-nav.open'
/** How long the mouse must rest on a group before it opens: a quick sweep down the rail opens nothing. */
const HOVER_INTENT_MS = 120

function readPinned(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [])
  } catch {
    return new Set()
  }
}

function without(set: Set<string>, id: string): Set<string> {
  if (!set.has(id)) return set
  const next = new Set(set)
  next.delete(id)
  return next
}

export interface NavGroups {
  isOpen: (id: string, holdsCurrentPage: boolean) => boolean
  /** Click / tap on a group header: closes it if it shows open, opens (and remembers) it if not. */
  toggle: (id: string, holdsCurrentPage: boolean) => void
  hoverStart: (id: string) => void
  hoverCancel: () => void
  /** The pointer left the sidebar: hover-opened groups close. */
  leaveRail: () => void
}

export function useNavGroups(): NavGroups {
  const [pinned, setPinned] = useState<Set<string>>(readPinned)
  const [hovered, setHovered] = useState<Set<string>>(() => new Set())
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...pinned]))
    } catch {
      // Private mode / blocked storage: the choice lasts for this visit only.
    }
  }, [pinned])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const isOpen = useCallback(
    (id: string, holdsCurrentPage: boolean) => holdsCurrentPage || pinned.has(id) || hovered.has(id),
    [pinned, hovered],
  )

  const toggle = useCallback(
    (id: string, holdsCurrentPage: boolean) => {
      // The group holding the current page always stays open.
      if (holdsCurrentPage) return
      const open = pinned.has(id) || hovered.has(id)
      setHovered((prev) => without(prev, id))
      setPinned((prev) => (open ? without(prev, id) : new Set(prev).add(id)))
    },
    [pinned, hovered],
  )

  const hoverStart = useCallback((id: string) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setHovered((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
    }, HOVER_INTENT_MS)
  }, [])

  const hoverCancel = useCallback(() => window.clearTimeout(timer.current), [])

  const leaveRail = useCallback(() => {
    window.clearTimeout(timer.current)
    setHovered((prev) => (prev.size ? new Set() : prev))
  }, [])

  return { isOpen, toggle, hoverStart, hoverCancel, leaveRail }
}
