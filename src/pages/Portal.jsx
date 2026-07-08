import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  FaBuilding,
  FaPenFancy,
  FaHandshake,
  FaLifeRing,
} from 'react-icons/fa'
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
    icon: <FaHandshake style={ICON_STYLE} aria-hidden="true" />,
    title: 'Partners',
    body: 'Access partner resources, landing pages, and account tools in one place.',
    linkLabel: 'Learn more',
    to: '/about',
  },
  {
    icon: <FaPenFancy style={ICON_STYLE} aria-hidden="true" />,
    title: 'Writers & Contributors',
    body: 'Submit articles, track drafts, and collaborate with the editorial team.',
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

export default function Portal() {
  useEffect(() => {
    const site = 'Struggling With Addiction'
    document.title = `Portal | ${site}`
    return () => { document.title = site }
  }, [])

  return (
    <main className="portal-page">
      <section className="portal-hero">
        <div className="container portal-hero-content">
          <span className="section-label">Partner & Client Access</span>
          <h1>Portal</h1>
          <p>
            A central place for treatment centers, partners, and contributors to manage
            listings, content, and account resources. This page is a preview — full
            sign-in and dashboard features are coming soon.
          </p>
        </div>
      </section>

      <section className="portal-body">
        <div className="container portal-layout">
          <aside className="portal-signin">
            <h2>Sign In</h2>
            <p className="portal-signin-intro">
              Use your account email and password to access the portal dashboard.
            </p>
            <form onSubmit={e => e.preventDefault()} noValidate>
              <div className="portal-field">
                <label htmlFor="portal-email">Email</label>
                <input
                  id="portal-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="you@example.com"
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
                />
              </div>
              <div className="portal-signin-actions">
                <button type="button" className="btn">Sign In</button>
                <button type="button" className="btn btn-outline">Forgot Password</button>
              </div>
            </form>
            <p className="portal-signin-note">
              This is a mockup preview. Authentication and account management will be
              available in a future release.
            </p>
          </aside>

          <div className="portal-options">
            <div className="portal-options-intro">
              <span className="section-label">Portal Areas</span>
              <h2>What You Can Access</h2>
              <p>
                The portal will bring together the tools treatment centers, partners,
                and contributors need to stay connected with the directory.
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
