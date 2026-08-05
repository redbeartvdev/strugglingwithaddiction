import { apiEnabled, fetchApi } from './api'

export function detectDevice() {
  const ua = navigator.userAgent || ''
  if (/iPad|Tablet|Kindle/i.test(ua)) return 'tablet'
  if (/Mobi|iPhone|Android/i.test(ua)) return 'mobile'
  return 'desktop'
}

export function analyticsSessionKey() {
  const key = 'swa_analytics_sid'
  let sid = sessionStorage.getItem(key)
  if (!sid) {
    sid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    sessionStorage.setItem(key, sid)
  }
  return sid
}

export function guessVisitorState() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    const map = {
      'America/New_York': 'New York',
      'America/Chicago': 'Illinois',
      'America/Denver': 'Colorado',
      'America/Los_Angeles': 'California',
      'America/Phoenix': 'Arizona',
      'America/Anchorage': 'Alaska',
      'Pacific/Honolulu': 'Hawaii',
      'America/Detroit': 'Michigan',
      'America/Indiana/Indianapolis': 'Indiana',
      'America/Boise': 'Idaho',
    }
    return map[tz] || 'Unknown'
  } catch {
    return 'Unknown'
  }
}

const SKIP_PREFIXES = ['/provider', '/swa-login', '/unsubscribe', '/claim-status', '/submit-center']

function shouldSkipPath(pathname) {
  const cleaned = (pathname || '/').split('?')[0].replace(/\/$/, '') || '/'
  return SKIP_PREFIXES.some(prefix => cleaned === prefix || cleaned.startsWith(`${prefix}/`))
}

/** Record one site pageview per path per browser session. */
export function trackSitePageview(pathname = window.location.pathname) {
  if (!apiEnabled()) return
  const path = (pathname || '/').split('?')[0] || '/'
  if (shouldSkipPath(path)) return

  const trackedKey = `swa_site_viewed_${path}`
  try {
    if (sessionStorage.getItem(trackedKey)) return
    sessionStorage.setItem(trackedKey, '1')
  } catch {
    /* private mode — still attempt once */
  }

  fetchApi('/api/analytics/pageview', {
    method: 'POST',
    body: JSON.stringify({
      path,
      page_title: document.title || null,
      referrer: document.referrer || null,
      visitor_state: guessVisitorState(),
      device_type: detectDevice(),
      session_key: analyticsSessionKey(),
    }),
  }).catch(() => {})
}
