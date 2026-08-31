/** Captured at first app load so later client-side routes do not look like a reload. */
function navigationType() {
  try {
    return performance.getEntriesByType('navigation')[0]?.type || 'navigate'
  } catch {
    return 'navigate'
  }
}

export const DOCUMENT_LOAD = {
  type: navigationType(),
  pathname: typeof window !== 'undefined' ? window.location.pathname : '',
}

export function isDocumentReloadOn(pathname) {
  if (DOCUMENT_LOAD.type !== 'reload') return false
  if (DOCUMENT_LOAD.pathname === pathname) return true
  return pathname !== '/' && DOCUMENT_LOAD.pathname.startsWith(`${pathname}/`)
}
