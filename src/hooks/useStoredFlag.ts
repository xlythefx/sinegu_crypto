import { useCallback, useState } from 'react'

function read(key: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? fallback : raw === '1'
  } catch {
    // Storage blocked (private mode, a locked-down browser): the default, every time.
    return fallback
  }
}

/**
 * A yes/no remembered on this device (localStorage), e.g. whether the video
 * editor's chat panel is open. Storage that cannot be read or written is
 * simply not used — the flag still works for the visit.
 */
export function useStoredFlag(key: string, fallback: boolean): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState(() => read(key, fallback))
  const set = useCallback(
    (next: boolean) => {
      setValue(next)
      try {
        window.localStorage.setItem(key, next ? '1' : '0')
      } catch {
        // Not remembered; fine.
      }
    },
    [key],
  )
  return [value, set]
}
