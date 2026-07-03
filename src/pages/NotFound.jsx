import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  FaHome,
  FaBookOpen,
  FaMapMarkerAlt,
  FaDoorOpen,
} from 'react-icons/fa'
import './NotFound.css'

const ICON_STYLE = { color: '#8c1126', fontSize: '1.75rem' }

const helpfulLinks = [
  {
    to: '/',
    icon: <FaHome style={ICON_STYLE} aria-hidden="true" />,
    title: 'Home',
    body: 'Return to our homepage for recovery resources, stories, and support.',
  },
  {
    to: '/rehab-centers',
    icon: <FaMapMarkerAlt style={ICON_STYLE} aria-hidden="true" />,
    title: 'Directory',
    body: 'Search our directory of accredited treatment centers near you.',
  },
  {
    to: '/blog',
    icon: <FaBookOpen style={ICON_STYLE} aria-hidden="true" />,
    title: 'Blog',
    body: 'Read evidence-based articles on addiction, recovery, and family support.',
  },
  {
    to: '/portal',
    icon: <FaDoorOpen style={ICON_STYLE} aria-hidden="true" />,
    title: 'Portal',
    body: 'Access partner and client resources.',
  },
]

export default function NotFound() {
  useEffect(() => {
    const prevTitle = document.title
    document.title = 'Page Not Found | Struggling With Addiction'

    let robots = document.querySelector('meta[name="robots"]')
    const hadRobots = Boolean(robots)
    const prevContent = robots?.getAttribute('content') ?? null

    if (!robots) {
      robots = document.createElement('meta')
      robots.setAttribute('name', 'robots')
      document.head.appendChild(robots)
    }
    robots.setAttribute('content', 'noindex, nofollow')

    return () => {
      document.title = prevTitle
      if (hadRobots && prevContent) {
        robots.setAttribute('content', prevContent)
      } else {
        robots?.remove()
      }
    }
  }, [])

  return (
    <main className="not-found-page">

      <section className="not-found-hero">
        <div className="not-found-hero-overlay" />
        <div className="container not-found-hero-content">
          <p className="not-found-code" aria-hidden="true">404</p>
          <span className="section-label" style={{ color: '#98b8c4' }}>Page Not Found</span>
          <h1>This Page Isn&apos;t Here —<br />But Help Still Is</h1>
          <p>
            The page you&apos;re looking for may have moved, been removed, or the address
            might be mistyped. You haven&apos;t reached a dead end — real support is still
            just one click or call away.
          </p>
          <div className="not-found-hero-actions">
            <Link to="/" className="btn">Back to Home</Link>
            <a href="tel:18005551234" className="btn btn-white-outline">Call the Helpline</a>
          </div>
        </div>
      </section>

      <section className="not-found-body">
        <div className="container">
          <div className="not-found-intro text-center">
            <span className="section-label">Where to Go Next</span>
            <h2>Find What You Need</h2>
            <p>
              Whether you&apos;re looking for treatment options, educational resources, or
              someone to talk to, these pages are a good place to start.
            </p>
          </div>
          <div className="not-found-links">
            {helpfulLinks.map(link => (
              <Link to={link.to} className="not-found-link-card" key={link.to}>
                <div className="not-found-link-icon">{link.icon}</div>
                <h3>{link.title}</h3>
                <p>{link.body}</p>
                <span className="not-found-link-arrow" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="not-found-cta">
        <div className="container not-found-cta-inner">
          <h2>Need Help Right Now?</h2>
          <p>
            Our confidential helpline is free, available 24/7, and staffed by real people
            who care. You don&apos;t have to navigate this alone.
          </p>
          <a href="tel:18005551234" className="btn">Call 1-800-555-1234</a>
        </div>
      </section>

    </main>
  )
}
