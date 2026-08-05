import { useEffect, useState } from 'react'
import { getPublicSiteUrl } from '../lib/publicSite'

function publicPortalUrl() {
  return `${getPublicSiteUrl()}/portal`
}

export default function Login() {
  const [error, setError] = useState('')

  useEffect(() => {
    const raw = window.location.hash.startsWith('#swa-auth=')
      ? window.location.hash.slice('#swa-auth='.length)
      : ''

    // `/portal` is the only provider sign-in screen. This route remains only
    // for the cross-origin token handoff used by local development.
    if (!raw) {
      window.location.replace(publicPortalUrl())
      return
    }

    try {
      const data = JSON.parse(atob(decodeURIComponent(raw)))
      if (!data?.access_token || !data?.refresh_token || !data?.role) {
        throw new Error('Missing sign-in credentials')
      }
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      if (data.role === 'admin') {
        const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
        window.location.replace(`${base}/swa-login/`)
        return
      }
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      localStorage.setItem('role', data.role)
      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
      const next = data.role === 'editor' ? 'editor' : 'client'
      window.location.replace(`${base}/${next}`)
    } catch {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      setError('Could not complete sign-in. Please return to the provider portal and try again.')
    }
  }, [])

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>{error ? 'Sign-in could not be completed' : 'Completing sign-in…'}</h1>
        {error ? <><p className="error">{error}</p><a href={publicPortalUrl()}>Return to provider login</a></> : <p>Please wait.</p>}
      </div>
    </main>
  )
}
