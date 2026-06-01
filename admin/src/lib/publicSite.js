/** Public site base URL for post links in admin. */
export function getPublicSiteUrl() {
  const url = import.meta.env.VITE_PUBLIC_SITE_URL
  if (url) return String(url).replace(/\/$/, '')
  if (import.meta.env.DEV) return 'http://127.0.0.1:5173'
  return ''
}

export function postPublicUrl(slug) {
  if (!slug) return ''
  const base = getPublicSiteUrl()
  return base ? `${base}/blog/${slug}` : `/blog/${slug}`
}

/** Format ISO date for datetime-local input. */
export function toDatetimeLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Parse datetime-local value to ISO string (UTC). */
export function fromDatetimeLocal(value) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

/** Map legacy archived status to draft in the editor UI. */
export function editorStatus(status) {
  return status === 'archived' ? 'draft' : status
}
