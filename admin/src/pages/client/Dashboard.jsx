import { Link } from 'react-router-dom'
import { useAuth } from '../../auth'
import Eyebrow from '../../components/ui/Eyebrow'
import Card from '../../components/ui/Card'

const LINKS = [
  { to: '/client/landing', label: 'Landing page' },
  { to: '/client/posts', label: 'Posts' },
  { to: '/client/center', label: 'Center profile' },
  { to: '/client/billing', label: 'Billing' },
]

export default function ClientDashboard() {
  const { user } = useAuth()
  const name = user?.display_name?.split(' ')[0] || 'there'

  return (
    <div className="page-stack">
      <section className="page-header-block">
        <Eyebrow>Partner</Eyebrow>
        <h1 className="hero-title">Welcome, {name}.</h1>
        <p className="hero-lead">Manage your listing, landing page, and subscription.</p>
      </section>
      <div className="link-grid">
        {LINKS.map(l => (
          <Link key={l.to} to={l.to} className="link-card">
            <span>{l.label}</span>
            <span>›</span>
          </Link>
        ))}
      </div>
      <Card className="feature-banner" pad={0}>
        <div className="feature-banner-inner">
          <div>
            <Eyebrow>Tip</Eyebrow>
            <h2 className="hero-title" style={{ fontSize: 24 }}>Keep billing active.</h2>
            <p className="hero-lead">Contact details on the public site require an active subscription.</p>
          </div>
          <Link to="/client/billing" className="btn btn-primary btn-lg">Billing</Link>
        </div>
      </Card>
    </div>
  )
}
