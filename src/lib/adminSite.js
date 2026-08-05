/** Admin / provider portal base URL. */
export function getAdminSiteUrl() {
  const configured = import.meta.env.VITE_ADMIN_SITE_URL
  if (configured && String(configured).trim()) {
    return String(configured).replace(/\/$/, '')
  }
  if (import.meta.env.DEV) {
    return 'http://127.0.0.1:5180'
  }
  // Railway monolith serves the admin SPA under /admin
  return `${window.location.origin}/admin`
}

/** Provider platform sign-in URL (SWA Studio). */
export function providerLoginUrl() {
  return `${window.location.origin}/portal`
}

/** Superadmin sign-in URL (SWA Studio). */
export function superadminLoginUrl() {
  return `${getAdminSiteUrl()}/swa-login/`
}

/** Public rehab provider login path. */
export function providerPortalPath() {
  return '/portal'
}

/** Path inside the admin SPA for the provider dashboard. */
export function providerDashboardPath() {
  return '/client'
}
