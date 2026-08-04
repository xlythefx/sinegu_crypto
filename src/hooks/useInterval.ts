import { useEffect, useRef } from 'react'

/**
 * Run `callback` every `delay` ms — pass `null` to pause. The latest callback
 * is kept in a ref, so an inline closure is fine. The interval also pauses
 * while the tab is hidden (no point polling a page nobody is looking at) and
 * resumes on return.
 */
export function useInterval(callback: () => void, delay: number | null) {
  const savedRef = useRef(callback)
  savedRef.current = callback

  useEffect(() => {
    if (delay === null) return

    let id: number | undefined

    const start = () => {
      if (id === undefined) {
        id = window.setInterval(() => savedRef.current(), delay)
      }
    }
    const stop = () => {
      if (id !== undefined) {
        window.clearInterval(id)
        id = undefined
      }
    }
    const onVisibility = () => {
      if (document.hidden) stop()
      else start()
    }

    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [delay])
}
