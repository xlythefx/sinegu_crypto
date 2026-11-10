import { useCallback, useMemo, useState } from 'react'
import { cleanParams, defaultParams } from '../lib/creatives'
import type {
  CreativeGenerationInput,
  CreativeModelPreset,
  CreativeParamValue,
  CreativePlatform,
  CreativeSource,
} from '../types/creatives'

export interface StudioDraft {
  model: CreativeModelPreset | null
  modelKey: string
  prompt: string
  params: Record<string, CreativeParamValue>
  useCharacter: boolean
  planId: number | null
  source: CreativeSource | null
  setModel: (key: string) => void
  setPrompt: (prompt: string) => void
  setParam: (name: string, value: CreativeParamValue) => void
  setUseCharacter: (on: boolean) => void
  /** Pick a plan (null = none); the aspect ratio follows its platform. */
  setPlan: (planId: number | null, platform: CreativePlatform | null) => void
  setSource: (source: CreativeSource | null) => void
  /** Switch to the animate model with this picture as its source. */
  animate: (source: CreativeSource) => void
  /** The request body exactly as Generate / Check price would send it. */
  input: CreativeGenerationInput | null
  /** Changes whenever the request would — an estimate is only good for its own key. */
  key: string
}

interface StudioDraftOptions {
  models: CreativeModelPreset[]
  initialPlanId: number | null
  initialPlatform: CreativePlatform | null
  /** The plan's video prompt ("Make the video") — the prompt box starts with it. */
  initialPrompt?: string
}

const ANIMATE_KEY = 'kling-animate'

/**
 * The Studio form's state. Changing the model resets its parameters to that
 * model's defaults (a 4:3 picked for one model may not exist on the next),
 * keeping the aspect ratio of the chosen plan's platform where it exists.
 */
export function useStudioDraft({ models, initialPlanId, initialPlatform, initialPrompt }: StudioDraftOptions): StudioDraft {
  const first = models[0] ?? null
  const [modelKey, setModelKey] = useState<string>(first?.key ?? '')
  const [prompt, setPrompt] = useState(initialPrompt ?? '')
  const [params, setParams] = useState<Record<string, CreativeParamValue>>(() =>
    first ? defaultParams(first, initialPlatform) : {},
  )
  const [useCharacter, setUseCharacter] = useState(true)
  const [planId, setPlanId] = useState<number | null>(initialPlanId)
  const [platform, setPlatform] = useState<CreativePlatform | null>(initialPlatform)
  const [source, setSource] = useState<CreativeSource | null>(null)

  const model = models.find((m) => m.key === modelKey) ?? first

  const setModel = useCallback(
    (key: string) => {
      const next = models.find((m) => m.key === key)
      if (!next) return
      setModelKey(key)
      setParams(defaultParams(next, platform))
      if (!next.needs_source) setSource(null)
    },
    [models, platform],
  )

  const setParam = useCallback((name: string, value: CreativeParamValue) => {
    setParams((prev) => ({ ...prev, [name]: value }))
  }, [])

  const setPlan = useCallback(
    (id: number | null, nextPlatform: CreativePlatform | null) => {
      setPlanId(id)
      setPlatform(nextPlatform)
      const ratio = model?.params.find((p) => p.name === 'aspect_ratio')
      if (model && nextPlatform && ratio) {
        const wanted = defaultParams(model, nextPlatform).aspect_ratio
        if (wanted !== undefined) setParams((prev) => ({ ...prev, aspect_ratio: wanted }))
      }
    },
    [model],
  )

  const animate = useCallback(
    (next: CreativeSource) => {
      const kling = models.find((m) => m.key === ANIMATE_KEY) ?? models.find((m) => m.needs_source)
      if (!kling) return
      if (kling.key !== modelKey) {
        setModelKey(kling.key)
        setParams(defaultParams(kling, platform))
      }
      setSource(next)
    },
    [models, modelKey, platform],
  )

  const input = useMemo<CreativeGenerationInput | null>(() => {
    if (!model) return null
    return {
      model: model.key,
      prompt: prompt.trim(),
      params: cleanParams(model, params),
      // A model that needs the character's references always uses it (the API forces it too).
      use_character: useCharacter || Boolean(model.requires_character),
      ...(planId !== null ? { plan_id: planId } : {}),
      ...(model.needs_source && source ? { source } : {}),
    }
  }, [model, prompt, params, useCharacter, planId, source])

  const key = useMemo(() => JSON.stringify(input), [input])

  return {
    model,
    modelKey: model?.key ?? '',
    prompt,
    params,
    useCharacter,
    planId,
    source,
    setModel,
    setPrompt,
    setParam,
    setUseCharacter,
    setPlan,
    setSource,
    animate,
    input,
    key,
  }
}
