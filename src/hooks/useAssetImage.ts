import { useEffect, useRef, useState } from 'react'
import type { AssetImageChange } from '../services/admin'

/** 2 MB — the API's own rule. */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024

/**
 * The ticker image on the asset page: the saved image, a newly picked file
 * (previewed from a blob URL, revoked when replaced or unmounted), or a request
 * to remove the saved one. `change` is what the save sends.
 */
export function useAssetImage(saved: string | null) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [remove, setRemove] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const pick = (picked: File | undefined) => {
    setError(null)
    if (!picked) return
    if (!picked.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    if (picked.size > MAX_IMAGE_BYTES) {
      setError('Image must be 2 MB or smaller.')
      return
    }
    setFile(picked)
    setPreviewUrl(URL.createObjectURL(picked))
    setRemove(false)
  }

  const clear = () => {
    setFile(null)
    setPreviewUrl(null)
    // Only a SAVED image needs deleting server-side.
    setRemove(Boolean(saved))
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const shown = previewUrl ?? (remove ? null : saved)
  const change: AssetImageChange = { file, remove }
  const changed = file !== null || remove

  return { shown, error, inputRef, pick, clear, change, changed }
}
