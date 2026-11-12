import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { loadAudioAsset } from '../lib/videoEditor/clips'
import { hasSoundtrack, mixTimeline } from '../lib/videoEditor/audioMix'
import type { CreativeAudioAsset, TimelineDoc } from '../types/creativeVideos'

/** Wait this long after the last change before mixing again. */
const REMIX_MS = 450

interface Options {
  timeline: TimelineDoc | null
  totalMs: number
  assets: CreativeAudioAsset[]
  playing: boolean
  timeRef: MutableRefObject<number>
  seekNonce: number
}

export interface PreviewSoundtrack {
  /** Call from the Play click: browsers only let sound start from a person's gesture. */
  unlock: () => void
  /** Mixing (or loading a file) for the preview. */
  preparing: boolean
  /** A library file could not be loaded. */
  problem: string | null
}

/**
 * The preview's music, voiceover and sound effects: the SAME mix the export
 * makes (lib/videoEditor/audioMix.ts — ducking included), rendered again a
 * moment after each change, and played from the playhead in step with the
 * preview's clock. The clips' own sound comes from the preview's <video>
 * elements, so it is left out here.
 */
export function usePreviewSoundtrack({ timeline, totalMs, assets, playing, timeRef, seekNonce }: Options): PreviewSoundtrack {
  const ctxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const unlock = useCallback(() => {
    if (typeof AudioContext === 'undefined') return
    ctxRef.current ??= new AudioContext()
    void ctxRef.current.resume()
  }, [])

  // Mix again after a change (debounced).
  const key = timeline ? JSON.stringify([timeline.music, timeline.voiceover, timeline.sfx, timeline.ducking, totalMs]) : ''
  useEffect(() => {
    if (!timeline || !hasSoundtrack(timeline) || totalMs <= 0) {
      setBuffer(null)
      return
    }
    let cancelled = false
    const t = window.setTimeout(async () => {
      setPreparing(true)
      try {
        const asset = (id: number) => assets.find((a) => a.id === id)
        const music = timeline.music?.source === 'asset' ? asset(timeline.music.asset_id) : undefined
        const voice = timeline.voiceover ? asset(timeline.voiceover.asset_id) : undefined
        const [musicBuffer, voiceBuffer] = await Promise.all([
          music ? loadAudioAsset(music) : Promise.resolve(null),
          voice ? loadAudioAsset(voice) : Promise.resolve(null),
        ])
        const mix = await mixTimeline({ durationMs: totalMs, timeline, musicBuffer, voiceBuffer, clips: [] })
        if (!cancelled) {
          setBuffer(mix)
          setProblem(null)
        }
      } catch {
        if (!cancelled) setProblem('A music or voiceover file could not be loaded for the preview.')
      } finally {
        if (!cancelled) setPreparing(false)
      }
    }, REMIX_MS)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, assets])

  // Play from the playhead; stop on pause, restart on a jump or a new mix.
  useEffect(() => {
    const stop = () => {
      try {
        sourceRef.current?.stop()
      } catch {
        // Already stopped.
      }
      sourceRef.current?.disconnect()
      sourceRef.current = null
    }
    stop()
    const ctx = ctxRef.current
    if (!playing || !buffer || !ctx) return stop
    const offset = timeRef.current / 1000
    if (offset >= buffer.duration) return stop
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(ctx.destination)
    src.start(ctx.currentTime + 0.02, offset)
    sourceRef.current = src
    return stop
  }, [playing, buffer, seekNonce, timeRef])

  useEffect(
    () => () => {
      void ctxRef.current?.close()
      ctxRef.current = null
    },
    [],
  )

  return { unlock, preparing, problem }
}
