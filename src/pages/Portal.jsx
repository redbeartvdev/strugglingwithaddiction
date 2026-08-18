import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FaBuilding,
  FaPenFancy,
  FaLifeRing,
} from 'react-icons/fa'
import { fetchApi } from '../lib/api'
import { getAdminSiteUrl, providerDashboardPath, superadminLoginUrl } from '../lib/adminSite'
import './Portal.css'

const ICON_STYLE = { color: '#8c1126', fontSize: '1.6rem' }

const portalCards = [
  {
    icon: <FaBuilding style={ICON_STYLE} aria-hidden="true" />,
    title: 'Treatment Centers',
    body: 'Claim your listing, update facility details, and manage your directory profile.',
    linkLabel: 'Browse directory',
    to: '/rehab-centers',
  },
  {
    icon: <FaPenFancy style={ICON_STYLE} aria-hidden="true" />,
    title: 'Writers & Contributors',
    body: (
      <>
        Submit articles, track drafts, and collaborate with the{' '}
        <Link to="/about">editorial team</Link>.
      </>
    ),
    linkLabel: 'Contact editorial',
    href: 'mailto:writers@strugglingwithaddiction.com',
  },
  {
    icon: <FaLifeRing style={ICON_STYLE} aria-hidden="true" />,
    title: 'Support',
    body: 'Get help with your account, listings, or general questions about the portal.',
    linkLabel: 'Email support',
    href: 'mailto:help@strugglingwithaddiction.com',
  },
]

function destinationForRole(role) {
  if (role === 'editor') return `${getAdminSiteUrl()}/editor`
  return `${getAdminSiteUrl()}${providerDashboardPath()}`
}

function encodeHandoffPayload(data) {
  const json = JSON.stringify({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    role: data.role,
  })
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function handoffToProviderDashboard(data) {
  const adminBase = getAdminSiteUrl()
  const dest = destinationForRole(data.role)
  let sameOrigin = false
  try {
    sameOrigin = new URL(adminBase, window.location.origin).origin === window.location.origin
  } catch {
    sameOrigin = false
  }

  if (sameOrigin) {
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    localStorage.setItem('role', data.role)
    window.location.assign(dest)
    return
  }

  // Local dual-server: public site and admin SPA are different origins.
  try {
    window.name = `swa-auth:${JSON.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      role: data.role,
    })}`
  } catch {
    /* window.name may be unavailable */
  }
  window.location.assign(`${dest}#swa-auth=${encodeHandoffPayload(data)}`)
}

export default function Portal() {
  const [mode, setMode] = useState('login') // 'login' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const site = 'Struggling With Addiction'
    document.title = `Rehab Provider Login | ${site}`
    return () => { document.title = site }
  }, [])

  function switchMode(next) {
    setMode(next)
    setError('')
    setMessage('')
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)
    try {
      const data = await fetchApi('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      })
      if (data.role === 'admin') {
        setError('Platform administrators must sign in at the superadmin login.')
        return
      }
      handoffToProviderDashboard(data)
    } catch (err) {
      setError(err.message || 'Unable to sign in.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)
    try {
      const result = await fetchApi('/api/auth/request-password-reset', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      })
      setMessage(result.message || 'If an account exists for that address, a reset link has been sent.')
    } catch (err) {
      setError(err.message || 'Unable to send reset email.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="portal-page">
      <section className="portal-hero">
        <div className="portal-hero-overlay" aria-hidden="true" />
        <div className="container portal-hero-content">
          <span className="section-label">Rehab Providers</span>
          <h1>Provider Login</h1>
          <p>
            Sign in to manage your claimed listing, leads, billing, and partner tools.
          </p>
        </div>
      </section>

      <section className="portal-body">
        <div className="container portal-layout">
          <aside className="portal-signin">
            {mode === 'login' ? (
              <>
                <h2>Sign In</h2>
                <p className="portal-signin-intro">
                  Use the email and password from when you claimed your listing.
                </p>
                <form onSubmit={handleLogin} noValidate>
                  <div className="portal-field">
                    <label htmlFor="portal-email">Email</label>
                    <input
                      id="portal-email"
                      type="email"
                      name="email"
                      autoComplete="email"
                      placeholder="you@yourfacility.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="portal-field">
                    <label htmlFor="portal-password">Password</label>
                    <input
                      id="portal-password"
                      type="password"
                      name="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  {error && (
                    <p className="portal-form-error" role="alert">
                      {error}
                      {error.includes('superadmin') && (
                        <>
                          {' '}
                          <a href={superadminLoginUrl()}>Open superadmin login</a>
                        </>
                      )}
                    </p>
                  )}
                  <div className="portal-signin-actions">
                    <button type="submit" className="btn" disabled={submitting}>
                      {submitting ? 'Signing in…' : 'Sign In'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => switchMode('forgot')}
                      disabled={submitting}
                    >
                      Forgot Password
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <h2>Forgot Password</h2>
                <p className="portal-signin-intro">
                  Enter your account email and we will send a password reset link if an account exists.
                </p>
                <form onSubmit={handleForgotPassword} noValidate>
                  <div className="portal-field">
                    <label htmlFor="portal-reset-email">Email</label>
                    <input
                      id="portal-reset-email"
                      type="email"
                      name="email"
                      autoComplete="email"
                      placeholder="you@yourfacility.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  {error && <p className="portal-form-error" role="alert">{error}</p>}
                  {message && <p className="portal-form-success" role="status">{message}</p>}
                  <div className="portal-signin-actions">
                    <button type="submit" className="btn" disabled={submitting}>
                      {submitting ? 'Sending…' : 'Email Reset Link'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => switchMode('login')}
                      disabled={submitting}
                    >
                      Back to Sign In
                    </button>
                  </div>
                </form>
              </>
            )}
            <p className="portal-signin-note">
              Already claimed and verified? Sign in here to open your provider dashboard.
              Still finishing your claim?{' '}
              <Link to="/rehab-centers">Find your listing</Link> or email{' '}
              <a href="mailto:help@strugglingwithaddiction.com">help@strugglingwithaddiction.com</a>.
            </p>
          </aside>

          <div className="portal-options">
            <div className="portal-options-intro">
              <span className="section-label">Provider Tools</span>
              <h2>What You Can Access</h2>
              <p>
                After you claim and activate your listing, the provider portal brings together
                the tools treatment centers need to stay connected with the directory.
              </p>
            </div>

            <div className="portal-cards">
              {portalCards.map(card => (
                <article className="portal-card" key={card.title}>
                  <div className="portal-card-icon">{card.icon}</div>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                  {card.to ? (
                    <Link to={card.to} className="portal-card-link">{card.linkLabel} →</Link>
                  ) : (
                    <a href={card.href} className="portal-card-link">{card.linkLabel} →</a>
                  )}
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="portal-cta">
        <div className="container portal-cta-inner">
          <h2>Need Help Getting Started?</h2>
          <p>
            Questions about claiming a listing or accessing the portal? Reach out to{' '}
            <a href="mailto:help@strugglingwithaddiction.com">help@strugglingwithaddiction.com</a>{' '}
            and our team will point you in the right direction.
          </p>
          <Link to="/rehab-centers" className="btn">Browse Treatment Centers</Link>
        </div>
      </section>
    </main>
  )
}
