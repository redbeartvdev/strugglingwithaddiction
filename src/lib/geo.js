import { fetchApi, apiEnabled } from './api'
import { US_STATE_ABBREVS, US_STATES } from './usStates'

const CACHE_KEY = 'swa_visitor_geo_v1'
const CACHE_TTL_MS = 1000 * 60 * 60 * 6

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_KEY)
      return null
    }
    return parsed.data || null
  } catch {
    return null
  }
}

function writeCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }))
  } catch {
    /* ignore quota / private mode */
  }
}

export function normalizeUsStateName(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const upper = raw.toUpperCase()
  if (US_STATE_ABBREVS[upper]) return US_STATE_ABBREVS[upper]
  const match = US_STATES.find(s => s.toLowerCase() === raw.toLowerCase())
  return match || ''
}

/** Resolve visitor state/city from IP via backend. Cached in sessionStorage. */
export async function detectVisitorLocation() {
  const cached = readCache()
  if (cached) return cached

  if (!apiEnabled()) {
    const empty = { state: '', city: '', source: 'offline' }
    writeCache(empty)
    return empty
  }

  try {
    const data = await fetchApi('/api/geo/me')
    const state = normalizeUsStateName(data?.state || data?.region)
    const city = String(data?.city || '').trim()
    const result = {
      state: state || '',
      city: city || '',
      country_code: data?.country_code || '',
      source: data?.source || 'api',
    }
    writeCache(result)
    return result
  } catch {
    const empty = { state: '', city: '', source: 'error' }
    writeCache(empty)
    return empty
  }
}
