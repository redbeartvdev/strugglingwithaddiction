import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { getPublicSiteUrl } from '../lib/publicSite'
import './Login.css'

const HERO_IMAGES = [
  '/images/Mindfulness-in-Recovery-Cultivating-Inner-Peace-After-Addiction_2426878099.webp',
  '/images/man-8598773_1280.webp',
  '/images/Breaking-the-Cycle-Overcoming-the-Worst-Relapse-Triggers-in-Recovery_1182413176.webp',
  '/images/The-Science-of-Healing-Evidence-Based-Addiction-Treatment_2140317261.webp',
]

function publicPath(path) {
  const base = getPublicSiteUrl()
  return base ? `${base}${path}` : path
}

export default function Login() {
  const { login, logout } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [apiOk, setApiOk] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [slide, setSlide] = useState(0)
  const homeUrl = publicPath('/')
  const rehabListUrl = publicPath('/rehab-centers')

  useEffect(() => {
    fetch('/health')
      .then(r => setApiOk(r.ok))
      .catch(() => setApiOk(false))
  }, [])

  useEffect(() => {
    const raw = window.location.hash.startsWith('#swa-auth=')
      ? window.location.hash.slice('#swa-auth='.length)
      : ''
    if (!raw) return
    try {
      const data = JSON.parse(atob(decodeURIComponent(raw)))
      if (!data?.access_token || !data?.refresh_token || !data?.role) return
      if (data.role === 'admin') {
        setError('Platform administrators must sign in at /swa-login/')
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
        return
      }
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      localStorage.setItem('role', data.role)
      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
      const next = data.role === 'editor' ? 'editor' : 'client'
      window.location.replace(`${base}/${next}`)
    } catch {
      setError('Could not complete sign-in handoff. Please sign in again.')
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [])

  useEffect(() => {
    const t = setInterval(() => setSlide(s => (s + 1) % HERO_IMAGES.length), 7000)
    return () => clearInterval(t)
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const role = await login(email, password)
      if (role === 'admin') {
        logout()
        setError('Platform administrators must sign in at /swa-login/')
        return
      }
      navigate(role === 'editor' ? '/editor' : '/client')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="provider-login">
      <div className="provider-login-bg" aria-hidden="true">
        {HERO_IMAGES.map((src, i) => (
          <div
            key={src}
            className={`provider-login-slide${i === slide ? ' is-active' : ''}`}
            style={{ backgroundImage: `url(${src})` }}
          />
        ))}
        <div className="provider-login-overlay" />
        <div className="provider-login-shimmer" />
      </div>

      <div className="provider-login-inner">
        <nav className="provider-login-back" aria-label="Site navigation">
          <a href={homeUrl}>← Home</a>
          <span className="provider-login-sep" aria-hidden="true">·</span>
          <a href={rehabListUrl}>Rehab centers</a>
        </nav>

        <div className="provider-login-brand">
          <a href={homeUrl} className="provider-login-logo-link">
            <img
              className="provider-login-logo"
              src="/images/SWA-logo-web-white-small_vSE-1.webp"
              alt="Struggling With Addiction"
            />
          </a>
          <span className="provider-login-brand-text">Provider platform</span>
        </div>

        <div className="provider-login-card">
          <p className="eyebrow">SWA Studio</p>
          <h1 className="provider-login-title">Welcome back.</h1>
          <p className="provider-login-lead">
            Sign in to manage your rehab listing, leads, and upgrades.
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
            <label htmlFor="provider-email">Email</label>
            <input
              id="provider-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <label htmlFor="provider-password">Password</label>
            <input
              id="provider-password"
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
            <Link to="/register">Partner registration</Link>
            <span className="provider-login-sep">·</span>
            <Link to="/reset-password">Forgot password?</Link>
          </p>
          <p className="provider-login-links provider-login-links-site">
            <a href={homeUrl}>Back to home</a>
            <span className="provider-login-sep">·</span>
            <a href={rehabListUrl}>Browse rehab centers</a>
          </p>
        </div>
      </div>

      <footer className="provider-login-footer">Developed by RedbearTV Dev Team</footer>
    </div>
  )
}
