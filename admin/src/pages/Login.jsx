import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Eyebrow from '../components/ui/Eyebrow'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [apiOk, setApiOk] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/health')
      .then(r => setApiOk(r.ok))
      .catch(() => setApiOk(false))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const role = await login(email, password)
      navigate(role === 'admin' ? '/admin' : role === 'editor' ? '/editor' : '/client')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <Card className="auth-card">
        <Eyebrow>Sign in</Eyebrow>
        <h1 className="page-title" style={{ marginTop: 8 }}>SWA Studio.</h1>
        {apiOk === false && (
          <p className="auth-status err">API offline. Start Postgres and uvicorn on port 8000.</p>
        )}
        {apiOk === true && <p className="auth-status ok">Connected.</p>}
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit} className="form-stack">
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
          <div className="form-actions">
            <Button type="submit" variant="primary" className="btn-block" disabled={submitting || apiOk === false}>
              {submitting ? 'Signing in…' : 'Continue'}
            </Button>
          </div>
        </form>
        <p className="muted" style={{ marginTop: 16, fontSize: 13, lineHeight: 1.5 }}>
          Production admin: use the email set in Railway <code>ADMIN_BOOTSTRAP_EMAIL</code>, or{' '}
          <code>pj@redbear.tv</code> with the import password from your deploy docs.
        </p>
        <p className="muted" style={{ marginTop: 20, textAlign: 'center' }}>
          <Link to="/register">Partner registration</Link>
        </p>
      </Card>
      <footer className="studio-footer studio-footer-auth">Developed by RedbearTV Dev Team</footer>
    </div>
  )
}
