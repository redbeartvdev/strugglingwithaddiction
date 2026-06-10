import { useEffect } from 'react'
import { setPageMeta } from './usePageSeo'

export function useDirectorySeo({ title, description, canonicalPath }) {
  useEffect(() => {
    const site = 'Struggling With Addiction'
    document.title = `${title} | ${site}`
    setPageMeta('description', description)
    setPageMeta('og:title', title, 'property')
    setPageMeta('og:description', description, 'property')
    setPageMeta('og:type', 'website', 'property')
    if (canonicalPath) {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      setPageMeta('og:url', `${origin}${canonicalPath}`, 'property')
    }
    return () => {
      document.title = site
    }
  }, [title, description, canonicalPath])
}
