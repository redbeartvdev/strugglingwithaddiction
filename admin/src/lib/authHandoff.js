const NAME_PREFIX = 'swa-auth:'
const HASH_PREFIX = '#swa-auth='

function decodeHashPayload(raw) {
  let value = String(raw || '').replace(/ /g, '+')
  try {
    value = decodeURIComponent(value)
  } catch {
    /* already decoded */
  }
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const withPad = padded + '='.repeat((4 - (padded.length % 4)) % 4)
  const data = JSON.parse(atob(withPad))
  if (!data?.access_token || !data?.refresh_token || !data?.role) {
    throw new Error('Missing sign-in credentials')
  }
  return data
}

function persistSession(data) {
  localStorage.setItem('access_token', data.access_token)
  localStorage.setItem('refresh_token', data.refresh_token)
  localStorage.setItem('role', data.role)
}

/** Read cross-origin portal tokens before React auth runs. Safe to call often. */
export function consumeAuthHandoff() {
  if (typeof window === 'undefined') return null
  if (window.__SWA_AUTH_HANDOFF__) return window.__SWA_AUTH_HANDOFF__

  let data = null
  const name = window.name || ''
  if (name.startsWith(NAME_PREFIX)) {
    try {
      const parsed = JSON.parse(name.slice(NAME_PREFIX.length))
      if (parsed?.access_token && parsed?.refresh_token && parsed?.role) data = parsed
    } catch {
      /* ignore malformed window.name */
    }
    window.name = ''
  }

  const hash = window.location.hash || ''
  if (!data && hash.startsWith(HASH_PREFIX)) {
    try {
      data = decodeHashPayload(hash.slice(HASH_PREFIX.length))
    } catch {
      /* ignore malformed hash */
    }
  }

  if (hash.startsWith(HASH_PREFIX)) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }

  if (!data) {
    window.__SWA_AUTH_HANDOFF__ = null
    return null
  }

  persistSession(data)
  window.__SWA_AUTH_HANDOFF__ = data
  return data
}
