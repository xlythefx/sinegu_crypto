import { useEffect } from 'react'

/**
 * Tells search engines to skip the page while it is mounted (a `robots`
 * noindex meta), and removes it again on leaving so no other page inherits it.
 * For a second copy of a public page — two indexed home pages would compete.
 */
export function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])
}
