import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'

/** How often the on-screen clock (playhead, time label) re-renders while playing. */
const UI_FRAME_MS = 66

export interface EditorPlayback {
  /** The precise time, read every animation frame by the preview. */
  timeRef: MutableRefObject<number>
  /** The same time for the rest of the screen, at ~15 fps. */
  timeMs: number
  playing: boolean
  /** Goes up on every jump (seek, end), so a follower re-syncs. */
  seekNonce: number
  play: () => void
  pause: () => void
  toggle: () => void
  seek: (ms: number) => void
}

/**
 * The editor's clock: play / pause / seek over `totalMs`, driven by
 * requestAnimationFrame. The preview reads `timeRef` every frame (smooth);
 * the timeline and labels get `timeMs`, updated about 15 times a second, so
 * the whole editor does not re-render 60 times a second. Stops at the end.
 */
export function useEditorPlayback(totalMs: number): EditorPlayback {
  const timeRef = useRef(0)
  const [timeMs, setTimeMs] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [seekNonce, setSeekNonce] = useState(0)
  const totalRef = useRef(totalMs)
  totalRef.current = totalMs

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    let lastUi = 0
    const step = (now: number) => {
      const dt = now - last
      last = now
      const next = timeRef.current + dt
      if (next >= totalRef.current) {
        timeRef.current = totalRef.current
        setTimeMs(totalRef.current)
        setPlaying(false)
        setSeekNonce((n) => n + 1)
        return
      }
      timeRef.current = next
      if (now - lastUi >= UI_FRAME_MS) {
        lastUi = now
        setTimeMs(next)
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  // A shorter video pulls the playhead back inside it.
  useEffect(() => {
    if (timeRef.current > totalMs) {
      timeRef.current = totalMs
      setTimeMs(totalMs)
    }
  }, [totalMs])

  const seek = useCallback((ms: number) => {
    const t = Math.max(0, Math.min(totalRef.current, ms))
    timeRef.current = t
    setTimeMs(t)
    setSeekNonce((n) => n + 1)
  }, [])

  const play = useCallback(() => {
    if (totalRef.current <= 0) return
    // Play from the start again once at the end.
    if (timeRef.current >= totalRef.current - 30) {
      timeRef.current = 0
      setTimeMs(0)
      setSeekNonce((n) => n + 1)
    }
    setPlaying(true)
  }, [])
  const pause = useCallback(() => {
    setPlaying(false)
    setTimeMs(timeRef.current)
  }, [])
  const toggle = useCallback(() => (playing ? pause() : play()), [playing, pause, play])

  return { timeRef, timeMs, playing, seekNonce, play, pause, toggle, seek }
}
