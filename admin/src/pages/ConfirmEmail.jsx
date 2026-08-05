import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { getPublicSiteUrl } from '../lib/publicSite'

export default function ConfirmEmail() {
  const [params] = useSearchParams()
  const [message, setMessage] = useState('Confirming your email…')

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      setMessage('This confirmation link is missing a token.')
      return
    }
    api('/api/auth/confirm-email', { method: 'POST', body: JSON.stringify({ token }) })
      .then(result => setMessage(result.message))
      .catch(error => setMessage(error.message))
  }, [params])

  return <main className="auth-page"><div className="auth-card"><h1>Email confirmation</h1><p>{message}</p><a href={`${getPublicSiteUrl()}/portal`}>Go to provider login</a></div></main>
}
