import { useCallback, useEffect, useState } from 'react'
import { useApiData } from './useApiData'
import { deleteCreativeAudio, getCreativeAudio, uploadCreativeAudio } from '../services/creativeAudio'
import type { AudioKind, CreativeAudioAsset } from '../types/creativeVideos'

export interface CreativeAudioState {
  audio: CreativeAudioAsset[] | null
  loading: boolean
  error: unknown
  reload: () => void
  upload: (file: Blob, input: { kind: AudioKind; label: string; durationMs?: number | null; filename?: string }) => Promise<CreativeAudioAsset>
  remove: (id: number) => Promise<void>
}

/** The shared audio library (music + voiceovers), newest uploads added in place. */
export function useCreativeAudio(): CreativeAudioState {
  const { data, loading, error, reload } = useApiData(getCreativeAudio)
  const [audio, setAudio] = useState<CreativeAudioAsset[] | null>(null)

  useEffect(() => {
    if (data) setAudio(data)
  }, [data])

  const upload = useCallback<CreativeAudioState['upload']>(async (file, input) => {
    const asset = await uploadCreativeAudio(file, input)
    setAudio((prev) => [asset, ...(prev ?? [])])
    return asset
  }, [])

  const remove = useCallback(async (id: number) => {
    await deleteCreativeAudio(id)
    setAudio((prev) => (prev ?? []).filter((a) => a.id !== id))
  }, [])

  return { audio, loading, error, reload, upload, remove }
}
