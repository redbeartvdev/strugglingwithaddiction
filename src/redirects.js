/**
 * 301 map for Search Console exports and known WordPress leftovers.
 * Wired into the FastAPI public HTML server (backend/app/seo/redirects.py).
 * Keep both files in sync. Paths have no trailing slash. One hop only —
 * do not point a `from` at another `from`.
 *
 * @typedef {{ from: string, to: string, status: 301 | 302 }} SeoRedirect
 */

/** @type {SeoRedirect[]} Populate from Search Console “Page with redirect” / not-found exports. */
export const SEARCH_CONSOLE_REDIRECTS = []

/** App-owned legacy paths that already had a client-side Navigate. */
export const BUILTIN_REDIRECTS = [
  { from: '/our-team', to: '/about', status: 301 },
  { from: '/privacy-policy-2', to: '/privacy', status: 301 },
]
