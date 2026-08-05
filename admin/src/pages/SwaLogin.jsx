import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import './Login.css'

export default function SwaLogin() {
  const { adminLogin, logout, user, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [apiOk, setApiOk] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && user?.role === 'admin') navigate('/admin', { replace: true })
  }, [loading, user, navigate])

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
      const role = await adminLogin(email, password)
      if (role !== 'admin') {
        logout()
        setError('This portal is for platform administrators only.')
        return
      }
      navigate('/admin')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="provider-login provider-login--admin">
      <div className="provider-login-bg" aria-hidden="true">
        <div
          className="provider-login-slide is-active"
          style={{
            backgroundImage:
              'url(/images/The-Science-of-Healing-Evidence-Based-Addiction-Treatment_2140317261.webp)',
          }}
        />
        <div className="provider-login-overlay" />
      </div>

      <div className="provider-login-inner">
        <div className="provider-login-brand">
          <img
            className="provider-login-logo"
            src="/images/SWA-logo-web-white-small_vSE-1.webp"
            alt="Struggling With Addiction"
          />
          <span className="provider-login-brand-text">Superadmin</span>
        </div>

        <div className="provider-login-card">
          <p className="eyebrow">SWA Platform</p>
          <h1 className="provider-login-title">Admin sign in</h1>
          <p className="provider-login-lead">
            Restricted access for platform administrators.
          </p>

          {apiOk === false && (
            <p className="provider-login-status err">
              API offline. Start Postgres and uvicorn on port 8317.
            </p>
          )}
          {apiOk === true && (
            <p className="provider-login-status ok">Connected to platform.</p>
          )}
          {error && <p className="provider-login-error">{error}</p>}

          <form onSubmit={handleSubmit} className="provider-login-form">
            <label htmlFor="swa-admin-email">Email</label>
            <input
              id="swa-admin-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
            <label htmlFor="swa-admin-password">Password</label>
            <input
              id="swa-admin-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <div className="provider-login-actions">
              <button
                type="submit"
                className="provider-login-submit"
                disabled={submitting || apiOk === false}
              >
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </div>
          </form>

          <p className="provider-login-links">
            <Link to="/reset-password">Forgot password?</Link>
          </p>
        </div>
      </div>

      <footer className="provider-login-footer">Developed by RedbearTV Dev Team</footer>
    </div>
  )
}
