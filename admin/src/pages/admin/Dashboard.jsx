import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../auth'
import Eyebrow from '../../components/ui/Eyebrow'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import { IconChevron, IconPlus } from '../../components/Icons'

export default function AdminDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ users: 0, posts: 0, centers: 0, claims: 0 })
  const [centers, setCenters] = useState([])
  const [activity, setActivity] = useState([])

  useEffect(() => {
    Promise.all([
      api('/api/admin/users').catch(() => []),
      api('/api/admin/posts').catch(() => []),
      api('/api/admin/rehab-centers').catch(() => []),
      api('/api/admin/claims').catch(() => []),
    ]).then(([users, posts, rehab, claims]) => {
      setStats({
        users: users.length,
        posts: posts.length,
        centers: rehab.length,
        claims: claims.filter(c => c.status === 'pending').length,
      })
      setCenters(rehab.slice(0, 3))
      setActivity(
        claims.slice(0, 4).map(c => ({
          time: new Date(c.created_at).toLocaleDateString(),
          msg: `${c.ticket_number} — ${c.center_name} (${c.status})`,
          tone: c.status === 'pending' ? 'warn' : c.status === 'approved' ? 'ok' : 'info',
        })),
      )
    })
  }, [])

  const name = user?.display_name?.split(' ')[0] || 'there'

  return (
    <div className="page-stack">
      <section className="page-header-block">
        <Eyebrow>Welcome back</Eyebrow>
        <h1 className="hero-title">Good morning, {name}.</h1>
        <p className="hero-lead">
          {stats.centers} rehab centers listed. {stats.claims > 0
            ? `${stats.claims} claim${stats.claims > 1 ? 's' : ''} awaiting review.`
            : 'No pending claims.'}
        </p>
        <div className="hero-actions">
          <Button variant="primary" size="lg" as={Link} to="/admin/claims">Review claims</Button>
          <Button variant="ghost" size="lg" as={Link} to="/admin/rehab">Add a center</Button>
        </div>
      </section>

      <section className="stat-row">
        {[
          { k: 'Users', v: String(stats.users), sub: 'accounts' },
          { k: 'Posts', v: String(stats.posts), sub: 'articles' },
          { k: 'Centers', v: String(stats.centers), sub: 'listings' },
          { k: 'Claims', v: String(stats.claims), sub: 'pending' },
        ].map(s => (
          <Card key={s.k} pad="sm">
            <Eyebrow>{s.k}</Eyebrow>
            <div className="stat-value">{s.v}</div>
            <div className="stat-sub">{s.sub}</div>
          </Card>
        ))}
      </section>

      <section className="panel-grid">
        <Card pad={0}>
          <div className="panel-head">
            <h3 className="section-title">Rehab centers</h3>
            <Button variant="link" size="sm" as={Link} to="/admin/rehab">
              <IconPlus size={14} /> Add
            </Button>
          </div>
          {centers.length === 0 ? (
            <p className="muted" style={{ padding: 20 }}>No centers yet.</p>
          ) : (
            centers.map((c, i) => (
              <Link key={c.id} to="/admin/rehab" className="list-row">
                <div className="list-thumb" />
                <div>
                  <div className="list-name">{c.name}</div>
                  <div className="list-sub">{c.location_display}</div>
                </div>
                <Badge tone={c.claimed ? 'ok' : 'neutral'} dot>{c.claimed ? 'Claimed' : 'Open'}</Badge>
                <IconChevron size={16} />
              </Link>
            ))
          )}
        </Card>

        <Card pad={0}>
          <div className="panel-head">
            <h3 className="section-title">Recent activity</h3>
          </div>
          <div style={{ padding: '4px 20px 16px' }}>
            {activity.length === 0 ? (
              <p className="muted">No recent claims.</p>
            ) : (
              activity.map((a, i) => (
                <div key={i} className="activity-item">
                  <span className={`activity-dot ${a.tone}`} />
                  <div>
                    <div className="activity-msg">{a.msg}</div>
                    <div className="activity-time">{a.time}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>

      <Card className="feature-banner" pad={0}>
        <div className="feature-banner-inner">
          <div>
            <Eyebrow>Studio · partner</Eyebrow>
            <h2 className="hero-title">Listings that convert.</h2>
            <p className="hero-lead">
              Approve claims and activate memberships so centers show contact details on the public site.
            </p>
          </div>
          <Button variant="primary" size="lg" as={Link} to="/admin/billing">Billing</Button>
        </div>
      </Card>
    </div>
  )
}
