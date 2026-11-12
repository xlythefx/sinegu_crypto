import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePoll } from './usePoll'
import { errorBudget } from '../lib/creatives'
import { agentErrorMessage } from '../lib/creativesAgent'
import { videoErrorMessage } from '../lib/creativeVideos'
import { moveScene as moveInOrder, overCap, sceneDurationMs, totalMs } from '../lib/videoEditor/timeline'
import { approveAgentJob, cancelAgentJob } from '../services/creativesAgent'
import {
  addCreativeVideoScene,
  deleteCreativeVideo,
  deleteCreativeVideoScene,
  getCreativeVideo,
  markCreativeVideoExported,
  proposeCreativeVideoScenes,
  updateCreativeVideo,
} from '../services/creativeVideos'
import type { CreativeAgentJob, CreativeBudget } from '../types/creatives'
import type {
  CreativeVideo,
  CreativeVideoScenePatch,
  SceneDraft,
  TemplateFields,
  TimelineDoc,
} from '../types/creativeVideos'

/** While a clip is being made the project is re-read this often (visible tab only). */
const POLL_MS = 5000
/** Edits are saved this long after the last change. */
const SAVE_DEBOUNCE_MS = 1500

type ScenePatch = Omit<CreativeVideoScenePatch, 'id'>

interface Overrides {
  title?: string
  timeline?: TimelineDoc
  scenes: Record<number, ScenePatch>
}

const EMPTY: Overrides = { scenes: {} }

const isEmpty = (o: Overrides) => o.title === undefined && o.timeline === undefined && Object.keys(o.scenes).length === 0

/** The server's video with the unsaved, client-owned edits laid over it. */
function applyOverrides(server: CreativeVideo, o: Overrides): CreativeVideo {
  if (isEmpty(o)) return server
  const scenes = server.scenes
    .map((s) => {
      const p = o.scenes[s.id]
      if (!p) return s
      const next = { ...s, ...p, template: p.template === undefined ? s.template : p.template }
      return { ...next, duration_ms: sceneDurationMs(next) }
    })
    .sort((a, b) => a.position - b.position)
  return {
    ...server,
    title: o.title ?? server.title,
    timeline: o.timeline ?? server.timeline,
    scenes,
    duration_ms: totalMs(scenes),
  }
}

export type VideoJobAction = 'approve' | 'cancel'

export interface CreativeVideoState {
  /** What the editor shows: the server's video plus unsaved edits. */
  video: CreativeVideo | null
  loading: boolean
  error: unknown
  reload: () => void
  /** When the video (so its clips' signed paths) was last read. */
  readAt: number
  dirty: boolean
  saving: boolean
  saveError: string | null
  savedAt: number | null
  /** Over the 30-s cap — saving waits until it is trimmed back. */
  tooLong: boolean
  setTitle: (title: string) => void
  updateTimeline: (fn: (tl: TimelineDoc) => TimelineDoc) => void
  updateScene: (id: number, patch: ScenePatch) => void
  moveScene: (id: number, delta: number) => void
  /** Save now (before an action that re-reads the project). Resolves false when it failed. */
  flush: () => Promise<boolean>
  /** An action that writes at once (add, remove, propose…) — its error sentence, or null. */
  busy: string | null
  actionError: string | null
  clearActionError: () => void
  addClip: (generationId: number, outputIndex: number, position?: number) => Promise<boolean>
  replaceClip: (sceneId: number, generationId: number, outputIndex: number) => Promise<boolean>
  addTemplate: (template: TemplateFields, seconds: number, position?: number) => Promise<boolean>
  removeScene: (sceneId: number) => Promise<boolean>
  propose: (drafts: SceneDraft[], replaceSceneId?: number) => Promise<CreativeAgentJob | null | false>
  approveJob: (job: CreativeAgentJob) => Promise<void>
  cancelJob: (job: CreativeAgentJob) => Promise<void>
  jobBusy: Record<number, VideoJobAction | undefined>
  jobErrors: Record<number, string | undefined>
  markExported: (stats: { seconds: number; bytes: number }) => Promise<void>
  deleteVideo: () => Promise<boolean>
}

/**
 * One video project in the editor. Loads it; while any scene is planned or
 * being made (or a job runs) re-reads it every 5 s — that read is also what
 * moves its jobs on, server-side; client-owned edits (title, timeline,
 * scene order / labels / trims / template text) are laid over the server's
 * copy at once and saved 1.5 s after the last change. Server-owned fields
 * (a scene's clip and status) always come from the latest read, so a clip
 * landing never undoes an edit, and an edit never hides a clip.
 */
export function useCreativeVideo(id: number, onBudget: (b: CreativeBudget) => void): CreativeVideoState {
  const [server, setServer] = useState<CreativeVideo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [tick, setTick] = useState(0)
  const [overrides, setOverrides] = useState<Overrides>(EMPTY)
  const [version, setVersion] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [jobBusy, setJobBusy] = useState<Record<number, VideoJobAction | undefined>>({})
  const [jobErrors, setJobErrors] = useState<Record<number, string | undefined>>({})

  const mounted = useRef(true)
  const overridesRef = useRef<Overrides>(EMPTY)
  const versionRef = useRef(0)
  const savingRef = useRef(false)
  const againRef = useRef(false)
  const readAt = useRef(0)
  const polling = useRef(false)
  const serverRef = useRef<CreativeVideo | null>(null)
  const budgetRef = useRef(onBudget)
  budgetRef.current = onBudget

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const putServer = useCallback((v: CreativeVideo) => {
    readAt.current = Date.now()
    serverRef.current = v
    setServer(v)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getCreativeVideo(id)
      .then((v) => {
        if (!cancelled) putServer(v)
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
  }, [id, tick, putServer])

  const reload = useCallback(() => setTick((t) => t + 1), [])

  const video = useMemo(() => (server ? applyOverrides(server, overrides) : null), [server, overrides])
  const dirty = !isEmpty(overrides)
  const tooLong = video ? overCap(video.scenes, video.max_seconds) : false

  /* ---------- edits ---------- */

  const edit = useCallback((fn: (o: Overrides) => Overrides) => {
    const next = fn(overridesRef.current)
    overridesRef.current = next
    versionRef.current += 1
    setOverrides(next)
    setVersion(versionRef.current)
    setSavedAt(null)
  }, [])

  const setTitle = useCallback((title: string) => edit((o) => ({ ...o, title })), [edit])

  const updateTimeline = useCallback(
    (fn: (tl: TimelineDoc) => TimelineDoc) =>
      edit((o) => {
        const base = o.timeline ?? serverRef.current?.timeline
        return base ? { ...o, timeline: fn(base) } : o
      }),
    [edit],
  )

  const updateScene = useCallback(
    (sceneId: number, patch: ScenePatch) =>
      edit((o) => ({ ...o, scenes: { ...o.scenes, [sceneId]: { ...o.scenes[sceneId], ...patch } } })),
    [edit],
  )

  const moveScene = useCallback(
    (sceneId: number, delta: number) => {
      const current = serverRef.current ? applyOverrides(serverRef.current, overridesRef.current) : null
      if (!current) return
      const moved = moveInOrder(current.scenes, sceneId, delta)
      edit((o) => {
        const scenes = { ...o.scenes }
        for (const s of moved) scenes[s.id] = { ...scenes[s.id], position: s.position }
        return { ...o, scenes }
      })
    },
    [edit],
  )

  /* ---------- saving ---------- */

  const save = useCallback(async (): Promise<boolean> => {
    const snap = overridesRef.current
    const base = serverRef.current
    if (isEmpty(snap) || !base) return true
    if (savingRef.current) {
      againRef.current = true
      return false
    }
    const merged = applyOverrides(base, snap)
    if (overCap(merged.scenes, merged.max_seconds)) {
      setSaveError(`The video is longer than ${merged.max_seconds} seconds, so it can’t be saved yet. Trim a scene or remove one.`)
      return false
    }
    const ver = versionRef.current
    const known = new Set(base.scenes.map((s) => s.id))
    const scenes = Object.entries(snap.scenes)
      .map(([sid, p]) => ({ id: Number(sid), ...p }))
      .filter((p) => known.has(p.id))
    savingRef.current = true
    setSaving(true)
    try {
      const next = await updateCreativeVideo(id, {
        ...(snap.title !== undefined ? { title: snap.title } : {}),
        ...(snap.timeline !== undefined ? { timeline: snap.timeline } : {}),
        ...(scenes.length > 0 ? { scenes } : {}),
      })
      if (!mounted.current) return true
      putServer(next)
      // Only what was sent is now on the server; anything typed since stays laid over it.
      if (versionRef.current === ver) {
        overridesRef.current = EMPTY
        setOverrides(EMPTY)
      }
      setSaveError(null)
      setSavedAt(Date.now())
      return true
    } catch (err) {
      if (mounted.current) setSaveError(videoErrorMessage(err, 'Your changes could not be saved. They are kept here; it tries again on the next change.'))
      return false
    } finally {
      savingRef.current = false
      if (mounted.current) setSaving(false)
      if (againRef.current) {
        againRef.current = false
        void Promise.resolve().then(() => saveRef.current())
      }
    }
  }, [id, putServer])

  const saveRef = useRef(save)
  saveRef.current = save

  useEffect(() => {
    if (version === 0 || isEmpty(overridesRef.current)) return
    const t = window.setTimeout(() => void saveRef.current(), SAVE_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [version])

  // Leaving the editor saves what is left; closing the tab with unsaved edits asks first.
  useEffect(() => () => void saveRef.current(), [])
  useEffect(() => {
    if (!dirty) return
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [dirty])

  const flush = useCallback(async () => {
    if (isEmpty(overridesRef.current)) return true
    return saveRef.current()
  }, [])

  /* ---------- polling while clips are being made ---------- */

  const needsPoll =
    !!server &&
    (server.scenes.some((s) => s.status === 'planned' || s.status === 'generating') ||
      server.jobs.some((j) => j.status === 'running'))

  usePoll(
    () => {
      if (polling.current) return
      polling.current = true
      getCreativeVideo(id)
        .then((v) => {
          if (mounted.current) putServer(v)
        })
        .catch(() => {
          // Keep what is on screen; the next tick tries again.
        })
        .finally(() => {
          polling.current = false
        })
    },
    POLL_MS,
    { paused: !needsPoll },
  )

  /* ---------- actions that write at once ---------- */

  const act = useCallback(
    async <T,>(label: string, fn: () => Promise<T>, fallback: string): Promise<T | false> => {
      if (busy) return false
      setBusy(label)
      setActionError(null)
      try {
        await flush()
        return await fn()
      } catch (err) {
        const b = errorBudget(err)
        if (b) budgetRef.current(b)
        if (mounted.current) setActionError(videoErrorMessage(err, fallback))
        return false
      } finally {
        if (mounted.current) setBusy(null)
      }
    },
    [busy, flush],
  )

  const addClip = useCallback(
    async (generationId: number, outputIndex: number, position?: number) => {
      const r = await act(
        'add',
        async () => putServer(await addCreativeVideoScene(id, { kind: 'clip', generation_id: generationId, output_index: outputIndex, ...(position !== undefined ? { position } : {}) })),
        'Could not add the clip.',
      )
      return r !== false
    },
    [act, id, putServer],
  )

  const replaceClip = useCallback(
    async (sceneId: number, generationId: number, outputIndex: number) => {
      const old = serverRef.current?.scenes.find((s) => s.id === sceneId)
      if (!old) return false
      const r = await act(
        'replace',
        async () => {
          // In at the old scene's place, then the old one out (positions are re-packed).
          await addCreativeVideoScene(id, { kind: 'clip', generation_id: generationId, output_index: outputIndex, position: old.position })
          putServer(await deleteCreativeVideoScene(id, sceneId))
        },
        'Could not replace the clip.',
      )
      return r !== false
    },
    [act, id, putServer],
  )

  const addTemplate = useCallback(
    async (template: TemplateFields, seconds: number, position?: number) => {
      const r = await act(
        'add',
        async () => putServer(await addCreativeVideoScene(id, { kind: 'template', template, seconds, ...(position !== undefined ? { position } : {}) })),
        'Could not add the card.',
      )
      return r !== false
    },
    [act, id, putServer],
  )

  const removeScene = useCallback(
    async (sceneId: number) => {
      const r = await act(
        'remove',
        async () => {
          putServer(await deleteCreativeVideoScene(id, sceneId))
          // Its unsaved edits go with it.
          if (overridesRef.current.scenes[sceneId]) {
            const rest = { ...overridesRef.current.scenes }
            delete rest[sceneId]
            overridesRef.current = { ...overridesRef.current, scenes: rest }
            setOverrides(overridesRef.current)
          }
        },
        'Could not remove the scene.',
      )
      return r !== false
    },
    [act, id, putServer],
  )

  const propose = useCallback(
    async (drafts: SceneDraft[], replaceSceneId?: number) => {
      return act(
        'propose',
        async () => {
          const { job, video: next } = await proposeCreativeVideoScenes(id, drafts, replaceSceneId)
          putServer(next)
          return job
        },
        'Could not price the scenes.',
      )
    },
    [act, id, putServer],
  )

  const jobAction = useCallback(
    async (job: CreativeAgentJob, action: VideoJobAction) => {
      if (jobBusy[job.id]) return
      setJobBusy((b) => ({ ...b, [job.id]: action }))
      setJobErrors((e) => ({ ...e, [job.id]: undefined }))
      try {
        const { budget } = action === 'approve' ? await approveAgentJob(job.id) : await cancelAgentJob(job.id)
        budgetRef.current(budget)
        if (mounted.current) putServer(await getCreativeVideo(id))
      } catch (err) {
        const b = errorBudget(err)
        if (b) budgetRef.current(b)
        const ctx = action === 'approve' ? ({ kind: 'approve', totalUsd: job.estimated_usd } as const) : ({ kind: 'cancel' } as const)
        if (mounted.current) {
          setJobErrors((e) => ({
            ...e,
            [job.id]: agentErrorMessage(err, ctx, action === 'approve' ? 'Could not start the job.' : 'Could not stop the job.'),
          }))
          getCreativeVideo(id).then(putServer).catch(() => undefined)
        }
      } finally {
        if (mounted.current) setJobBusy((b) => ({ ...b, [job.id]: undefined }))
      }
    },
    [id, jobBusy, putServer],
  )

  const approveJob = useCallback((job: CreativeAgentJob) => jobAction(job, 'approve'), [jobAction])
  const cancelJob = useCallback((job: CreativeAgentJob) => jobAction(job, 'cancel'), [jobAction])

  const markExported = useCallback(
    async (stats: { seconds: number; bytes: number }) => {
      try {
        const next = await markCreativeVideoExported(id, stats)
        if (mounted.current) putServer(next)
      } catch {
        // The file is already downloaded; the record is only a note on the project.
      }
    },
    [id, putServer],
  )

  const deleteVideo = useCallback(async () => {
    const r = await act(
      'delete',
      async () => {
        overridesRef.current = EMPTY
        setOverrides(EMPTY)
        await deleteCreativeVideo(id)
      },
      'Could not delete the project.',
    )
    return r !== false
  }, [act, id])

  return {
    video,
    loading,
    error,
    reload,
    readAt: readAt.current,
    dirty,
    saving,
    saveError,
    savedAt,
    tooLong,
    setTitle,
    updateTimeline,
    updateScene,
    moveScene,
    flush,
    busy,
    actionError,
    clearActionError: () => setActionError(null),
    addClip,
    replaceClip,
    addTemplate,
    removeScene,
    propose,
    approveJob,
    cancelJob,
    jobBusy,
    jobErrors,
    markExported,
    deleteVideo,
  }
}
