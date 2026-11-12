import { useCallback, useEffect, useState } from 'react'
import { useApiData } from './useApiData'
import {
  createCreativeStyle,
  deleteCreativeStyle,
  getCreativeStyles,
  updateCreativeStyle,
} from '../services/creativesAgent'
import type { CreativeStyle, CreativeStyleInput } from '../types/creatives'

export interface CreativeStylesState {
  styles: CreativeStyle[] | null
  loading: boolean
  error: unknown
  reload: () => void
  create: (input: CreativeStyleInput) => Promise<CreativeStyle>
  update: (id: number, patch: Partial<CreativeStyleInput>) => Promise<CreativeStyle>
  remove: (id: number) => Promise<void>
}

const order = (list: CreativeStyle[]) => [...list].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))

/** The marketing styles, kept in the API's order (sort, then name) after every write. */
export function useCreativeStyles(): CreativeStylesState {
  const { data, loading, error, reload } = useApiData(getCreativeStyles)
  const [styles, setStyles] = useState<CreativeStyle[] | null>(null)

  useEffect(() => {
    if (data) setStyles(order(data))
  }, [data])

  const create = useCallback(async (input: CreativeStyleInput) => {
    const style = await createCreativeStyle(input)
    setStyles((prev) => order([...(prev ?? []), style]))
    return style
  }, [])

  const update = useCallback(async (id: number, patch: Partial<CreativeStyleInput>) => {
    const style = await updateCreativeStyle(id, patch)
    setStyles((prev) => order((prev ?? []).map((s) => (s.id === id ? style : s))))
    return style
  }, [])

  const remove = useCallback(async (id: number) => {
    await deleteCreativeStyle(id)
    setStyles((prev) => (prev ?? []).filter((s) => s.id !== id))
  }, [])

  return { styles, loading, error, reload, create, update, remove }
}
