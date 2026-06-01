import { Link } from 'react-router-dom'
import { useAuth } from '../../auth'
import Eyebrow from '../../components/ui/Eyebrow'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

export default function EditorDashboard() {
  const { user } = useAuth()
  const name = user?.display_name?.split(' ')[0] || 'there'

  return (
    <div className="page-stack">
      <section className="page-header-block">
        <Eyebrow>Editor</Eyebrow>
        <h1 className="hero-title">Hello, {name}.</h1>
        <p className="hero-lead">Draft and publish articles for the public blog.</p>
        <div className="hero-actions">
          <Button variant="primary" size="lg" as={Link} to="/editor/posts">Manage posts</Button>
        </div>
      </section>
      <Card>
        <Eyebrow>Quick link</Eyebrow>
        <Link to="/editor/posts" className="link-card" style={{ marginTop: 12 }}>
          <span>Posts</span>
          <span>›</span>
        </Link>
      </Card>
    </div>
  )
}
