import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

export default function AdminDirectory() {
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/api/admin/directory-pages')
      .then(setPages)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">SEO</p>
          <h1 className="page-title">Directory pages</h1>
          <p className="muted">State and city pillar pages for long-tail search.</p>
        </div>
        <Button variant="primary" as={Link} to="/admin/directory/new">New page</Button>
      </header>

      <Card>
        {loading && <p className="muted">Loading…</p>}
        {!loading && pages.length === 0 && (
          <p className="muted">No directory pages yet. Run seed script or create a state page.</p>
        )}
        {!loading && pages.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Path</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pages.map(p => (
                <tr key={p.id}>
                  <td>{p.title}</td>
                  <td>{p.page_type}</td>
                  <td>
                    /rehab-centers/location/{p.state_slug}
                    {p.city_slug ? `/${p.city_slug}` : ''}
                  </td>
                  <td>{p.status}</td>
                  <td>
                    <Button variant="ghost" size="sm" as={Link} to={`/admin/directory/${p.id}/edit`}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
