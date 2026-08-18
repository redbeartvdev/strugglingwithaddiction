import { useEffect, useState } from 'react'
import { getPublicSiteUrl } from '../lib/publicSite'
import { consumeAuthHandoff } from '../lib/authHandoff'

function publicPortalUrl() {
  return `${getPublicSiteUrl()}/portal`
}

function dashboardPath(role) {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  if (role === 'admin') return `${base}/swa-login/`
  const next = role === 'editor' ? 'editor' : 'client'
  return `${base}/${next}`
}

export default function Login() {
  const [error, setError] = useState('')

  useEffect(() => {
    const handedOff = consumeAuthHandoff()
    const role = handedOff?.role || localStorage.getItem('role')
    const token = handedOff?.access_token || localStorage.getItem('access_token')

    if (token && role && role !== 'admin') {
      window.location.replace(dashboardPath(role))
      return
    }

    if (handedOff) {
      setError('Could not complete sign-in. Please return to the provider portal and try again.')
      return
    }

    window.location.replace(publicPortalUrl())
  }, [])

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>{error ? 'Sign-in could not be completed' : 'Completing sign-in…'}</h1>
        {error ? (
          <>
            <p className="error">{error}</p>
            <a href={publicPortalUrl()}>Return to provider login</a>
          </>
        ) : (
          <p>Please wait.</p>
        )}
      </div>
    </main>
  )
}
