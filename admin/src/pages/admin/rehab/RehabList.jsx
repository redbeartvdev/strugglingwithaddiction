import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../api'
import Button from '../../../components/ui/Button'
import Badge from '../../../components/ui/Badge'
import { IconExternalLink } from '../../../components/Icons'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function RehabList() {
  const [tab, setTab] = useState('active')
  const [centers, setCenters] = useState([])

  const load = () => api(`/api/admin/rehab-centers?trash=${tab === 'trash'}`).then(setCenters)
  useEffect(() => { load() }, [tab])

  async function moveToTrash(id) {
    if (!confirm('Move this center to trash?')) return
    await api(`/api/admin/rehab-centers/${id}`, { method: 'DELETE' })
    load()
  }

  async function restore(id) {
    await api(`/api/admin/rehab-centers/${id}/restore`, { method: 'POST' })
    load()
  }

  async function permanentDelete(id) {
    if (!confirm('Permanently delete this center?')) return
    await api(`/api/admin/rehab-centers/${id}/permanent`, { method: 'DELETE' })
    load()
  }

  const statusTone = s => (s === 'published' ? 'ok' : s === 'draft' ? 'warn' : 'neutral')

  return (
    <div className="page-stack">
      <header className="page-header" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="page-title">Rehab.</h1>
          <p className="page-sub">{tab === 'trash' ? 'Trashed centers' : 'All centers'}</p>
        </div>
        {tab === 'active' && (
          <Button variant="primary" as={Link} to="/admin/rehab/new">New center</Button>
        )}
      </header>

      <div className="tabs-row">
        <button type="button" className={`tab-btn${tab === 'active' ? ' active' : ''}`} onClick={() => setTab('active')}>All centers</button>
        <button type="button" className={`tab-btn${tab === 'trash' ? ' active' : ''}`} onClick={() => setTab('trash')}>Trash</button>
      </div>

      <div className="card card-pad-0 table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Location</th>
              <th>Status</th>
              <th>Claimed</th>
              <th>Published</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {centers.length === 0 ? (
              <tr><td colSpan={6} className="muted" style={{ padding: 24 }}>No centers.</td></tr>
            ) : (
              centers.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.location_display || '—'}</td>
                  <td><Badge tone={statusTone(c.listing_status)}>{c.listing_status}</Badge></td>
                  <td>
                    <span className={c.claimed ? 'claimed-yes' : 'claimed-no'}>
                      {c.claimed ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td>{formatDate(c.published_at)}</td>
                  <td className="table-actions">
                    {tab === 'active' ? (
                      <>
                        {c.website && (
                          <a href={c.website} target="_blank" rel="noopener noreferrer" className="view-post-btn" title="Open website" aria-label="Open website">
                            <IconExternalLink size={16} />
                          </a>
                        )}
                        <Button variant="link" size="sm" as={Link} to={`/admin/rehab/${c.id}/edit`}>Edit</Button>
                        <Button variant="link" size="sm" type="button" onClick={() => moveToTrash(c.id)}>Delete</Button>
                      </>
                    ) : (
                      <>
                        <Button variant="link" size="sm" type="button" onClick={() => restore(c.id)}>Restore</Button>
                        <Button variant="link" size="sm" type="button" onClick={() => permanentDelete(c.id)}>Delete forever</Button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
