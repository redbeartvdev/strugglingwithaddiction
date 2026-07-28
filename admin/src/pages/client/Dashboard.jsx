import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../../auth'
import { api } from '../../api'
import Eyebrow from '../../components/ui/Eyebrow'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import './Dashboard.css'

const WHATS_NEW_KEY = 'swa-client-whats-new-v2026-07-24'

const WHATS_NEW = [
  {
    title: 'Listing analytics',
    body: 'See profile visits, visitor states, device types, and lead conversion for 1 hour, 12 hours, today, week, month, year, or a custom date range.',
  },
  {
    title: 'USA insurance picker',
    body: 'Choose accepted insurance plans with logos. They show on your public landing page and power the directory search filter.',
  },
  {
    title: 'Redesigned profile editor',
    body: 'Manage Overview, Listing, Insurance, Media, Partner page, and Analytics in one Profile Page Editor — with clearer sections and faster publishing.',
  },
]

const LINKS = [
  { to: '/client/profile', label: 'Profile Page Editor', detail: 'Listing, insurance, gallery, and partner page' },
  { to: '/client/profile?tab=analytics', label: 'Analytics', detail: 'Visits, states, devices, and leads' },
  { to: '/client/profile?tab=insurance', label: 'Insurance', detail: 'Accepted USA plans with logos' },
  { to: '/client/profile?tab=partner', label: 'Partner page', detail: 'Headline, about, and publish settings' },
  { to: '/client/leads', label: 'Leads inbox', detail: 'Inquiries from your landing page' },
  { to: '/client/upsells', label: 'Upgrades', detail: 'Verified badge, featured placement, articles' },
  { to: '/client/billing', label: 'Billing', detail: 'Subscription and invoices' },
]

function WhatsNewModal({ name, open, onClose }) {
  if (!open) return null
  return (
    <div className="modal-overlay cd-welcome-overlay" onClick={onClose} role="presentation">
      <div
        className="card modal-card cd-welcome-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cd-welcome-title"
      >
        <p className="eyebrow">What&apos;s new</p>
        <h2 id="cd-welcome-title" className="cd-welcome-title">Welcome back, {name}.</h2>
        <p className="cd-welcome-lead">
          Here are the latest updates on your provider dashboard.
        </p>
        <ul className="cd-welcome-list">
          {WHATS_NEW.map(item => (
            <li key={item.title}>
              <strong>{item.title}</strong>
              <span>{item.body}</span>
            </li>
          ))}
        </ul>
        <div className="cd-welcome-actions">
          <Link className="btn btn-primary" to="/client/profile?tab=analytics" onClick={onClose}>
            Open analytics
          </Link>
          <Button type="button" variant="ghost" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function ClientDashboard() {
  const { user } = useAuth()
  const name = user?.display_name?.split(' ')[0] || 'there'
  const [center, setCenter] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [showWelcome, setShowWelcome] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(WHATS_NEW_KEY)) {
        setShowWelcome(true)
      }
    } catch {
      setShowWelcome(true)
    }
  }, [])

  useEffect(() => {
    api('/api/client/my-center')
      .then(setCenter)
      .catch(() => setCenter(null))
    api('/api/client/analytics?range=today')
      .then(setAnalytics)
      .catch(() => setAnalytics(null))
  }, [])

  function dismissWelcome() {
    try {
      localStorage.setItem(WHATS_NEW_KEY, '1')
    } catch {
      /* ignore */
    }
    setShowWelcome(false)
  }

  const pct = center?.completeness?.percent ?? 0
  const insuranceCount = (center?.insurances || []).length
  const summary = analytics?.summary

  return (
    <div className="page-stack cd-page">
      <WhatsNewModal name={name} open={showWelcome} onClose={dismissWelcome} />

      <section className="page-header-block">
        <Eyebrow>Provider platform</Eyebrow>
        <h1 className="hero-title">Welcome, {name}.</h1>
        <p className="hero-lead">
          Your listing performance, insurance, leads, and upgrades — all in one place.
        </p>
        <button type="button" className="btn btn-ghost btn-sm cd-whats-new-btn" onClick={() => setShowWelcome(true)}>
          What&apos;s new
        </button>
      </section>

      {center?.public_listing_url && (
        <Card className="listing-summary">
          <div className="cd-listing-row">
            <div>
              <Eyebrow>Your public page</Eyebrow>
              <p className="listing-summary-name">{center.name}</p>
              <div className="listing-summary-actions">
                <a className="btn btn-primary" href={center.public_listing_url} target="_blank" rel="noreferrer">View listing</a>
                <Link className="btn btn-ghost" to="/client/profile">Edit profile</Link>
                <Link className="btn btn-ghost" to="/client/upsells">View upgrades</Link>
              </div>
            </div>
            <div className="cd-complete">
              <div className="cd-complete-ring" style={{ '--pct': pct }}>
                <span>{pct}%</span>
              </div>
              <p className="muted">Profile complete</p>
            </div>
          </div>
        </Card>
      )}

      <div className="cd-stat-grid">
        <Card className="cd-stat-card">
          <p className="cd-stat-label">Visits today</p>
          <p className="cd-stat-value">{summary ? summary.page_views : '—'}</p>
          <p className="cd-stat-hint">{summary ? `${summary.unique_sessions} unique sessions` : 'Open analytics for ranges'}</p>
          <Link className="cd-stat-link" to="/client/profile?tab=analytics">View analytics ›</Link>
        </Card>
        <Card className="cd-stat-card">
          <p className="cd-stat-label">Leads today</p>
          <p className="cd-stat-value">{summary ? summary.leads : '—'}</p>
          <p className="cd-stat-hint">{summary ? `${summary.unread_leads} unread · ${summary.conversion_rate}% conversion` : 'Lead submissions from your page'}</p>
          <Link className="cd-stat-link" to="/client/leads">Open inbox ›</Link>
        </Card>
        <Card className="cd-stat-card">
          <p className="cd-stat-label">Insurance plans</p>
          <p className="cd-stat-value">{center ? insuranceCount : '—'}</p>
          <p className="cd-stat-hint">Shown with logos on your landing page & search filter</p>
          <Link className="cd-stat-link" to="/client/profile?tab=insurance">Manage insurance ›</Link>
        </Card>
      </div>

      {(analytics?.by_device?.length > 0 || analytics?.by_state?.length > 0) && (
        <div className="cd-insight-grid">
          <Card>
            <Eyebrow>Top visitor states · today</Eyebrow>
            <ul className="cd-rank-list">
              {(analytics.by_state || []).slice(0, 5).map(row => (
                <li key={row.state}>
                  <span>{row.state}</span>
                  <strong>{row.views}</strong>
                </li>
              ))}
              {!analytics.by_state?.length && <li className="muted">No visits yet today.</li>}
            </ul>
          </Card>
          <Card>
            <Eyebrow>Devices · today</Eyebrow>
            <ul className="cd-rank-list">
              {(analytics.by_device || []).map(row => (
                <li key={row.device}>
                  <span className="cd-device-cap">{row.device}</span>
                  <strong>{row.views}</strong>
                </li>
              ))}
              {!analytics.by_device?.length && <li className="muted">No device data yet.</li>}
            </ul>
          </Card>
        </div>
      )}

      <div className="link-grid">
        {LINKS.map(l => (
          <Link key={l.to} to={l.to} className="link-card">
            <span>
              <strong className="link-card-label">{l.label}</strong>
              <span className="link-card-detail muted">{l.detail}</span>
            </span>
            <span className="link-card-chevron" aria-hidden="true">›</span>
          </Link>
        ))}
      </div>

      <Card className="feature-banner" pad={0}>
        <div className="feature-banner-inner">
          <div>
            <Eyebrow>Tip</Eyebrow>
            <h2 className="feature-banner-title">Keep billing active</h2>
            <p className="feature-banner-lead">
              Contact details, insurance logos, and analytics require an active subscription.
            </p>
          </div>
          <Link to="/client/billing" className="btn btn-primary">Go to billing</Link>
        </div>
      </Card>
    </div>
  )
}
