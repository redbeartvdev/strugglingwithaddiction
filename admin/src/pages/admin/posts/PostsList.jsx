import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../../../api'
import { useAuth } from '../../../auth'
import Button from '../../../components/ui/Button'
import Badge from '../../../components/ui/Badge'

function postsBase(pathname) {
  return pathname.startsWith('/editor') ? '/editor/posts' : '/admin/posts'
}

export default function PostsList() {
  const { pathname } = useLocation()
  const base = postsBase(pathname)
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [tab, setTab] = useState('active')
  const [posts, setPosts] = useState([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [retention, setRetention] = useState(6)
  const [savingSettings, setSavingSettings] = useState(false)

  const listPath = isAdmin && pathname.startsWith('/admin')
    ? `/api/admin/posts?trash=${tab === 'trash'}`
    : `/api/editor/posts?trash=${tab === 'trash'}`

  const load = () => api(listPath).then(setPosts)

  useEffect(() => { load() }, [tab, listPath])

  useEffect(() => {
    if (isAdmin) {
      api('/api/admin/blog-settings').then(s => setRetention(s.trash_retention_months)).catch(() => {})
    }
  }, [isAdmin])

  async function moveToTrash(id) {
    if (!confirm('Move this post to trash?')) return
    await api(`/api/editor/posts/${id}`, { method: 'DELETE' })
    load()
  }

  async function restore(id) {
    await api(`/api/editor/posts/${id}/restore`, { method: 'POST' })
    load()
  }

  async function permanentDelete(id) {
    if (!confirm('Permanently delete this post? This cannot be undone.')) return
    await api(`/api/editor/posts/${id}/permanent`, { method: 'DELETE' })
    load()
  }

  async function saveSettings(e) {
    e.preventDefault()
    setSavingSettings(true)
    try {
      await api('/api/admin/blog-settings', {
        method: 'PATCH',
        body: JSON.stringify({ trash_retention_months: retention }),
      })
      setSettingsOpen(false)
    } finally {
      setSavingSettings(false)
    }
  }

  const tone = s => (s === 'published' ? 'ok' : s === 'private' ? 'info' : s === 'draft' ? 'warn' : 'neutral')

  return (
    <div className="page-stack">
      <header className="page-header" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <p className="eyebrow">Content</p>
          <h1 className="page-title">Posts.</h1>
          <p className="page-sub">{tab === 'trash' ? 'Trashed posts' : 'All posts'}</p>
        </div>
        <div className="hero-actions" style={{ marginTop: 0 }}>
          {isAdmin && (
            <Button variant="ghost" size="sm" type="button" onClick={() => setSettingsOpen(true)}>
              Trash settings
            </Button>
          )}
          {tab === 'active' && (
            <Button variant="primary" as={Link} to={`${base}/new`}>New post</Button>
          )}
        </div>
      </header>

      <div className="tabs-row">
        <button type="button" className={`tab-btn${tab === 'active' ? ' active' : ''}`} onClick={() => setTab('active')}>
          All posts
        </button>
        <button type="button" className={`tab-btn${tab === 'trash' ? ' active' : ''}`} onClick={() => setTab('trash')}>
          Trash
        </button>
      </div>

      <div className="card card-pad-0 table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 ? (
              <tr><td colSpan={4} className="muted" style={{ padding: 24 }}>No posts.</td></tr>
            ) : (
              posts.map(p => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.title}</strong>
                    <div className="muted" style={{ marginTop: 2 }}>{p.slug}</div>
                  </td>
                  <td><Badge tone={tone(p.status)}>{p.status}</Badge></td>
                  <td>{new Date(p.updated_at).toLocaleDateString()}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {tab === 'active' ? (
                      <>
                        <Button variant="link" size="sm" as={Link} to={`${base}/${p.id}/edit`}>Edit</Button>
                        <Button variant="link" size="sm" type="button" onClick={() => moveToTrash(p.id)}>Delete</Button>
                      </>
                    ) : (
                      <>
                        <Button variant="link" size="sm" type="button" onClick={() => restore(p.id)}>Restore</Button>
                        <Button variant="link" size="sm" type="button" onClick={() => permanentDelete(p.id)}>Delete forever</Button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {settingsOpen && (
        <div className="modal-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="card modal-card" onClick={e => e.stopPropagation()}>
            <p className="eyebrow">Trash retention</p>
            <h2 className="section-title" style={{ marginTop: 8 }}>Auto-delete from trash</h2>
            <p className="muted" style={{ marginBottom: 16 }}>
              Posts in trash are permanently removed after the selected period.
            </p>
            <form onSubmit={saveSettings} className="form-stack">
              {[1, 6, 12].map(m => (
                <label key={m} className="radio-row">
                  <input
                    type="radio"
                    name="retention"
                    checked={retention === m}
                    onChange={() => setRetention(m)}
                  />
                  {m} month{m > 1 ? 's' : ''}
                </label>
              ))}
              <div className="form-actions">
                <Button type="submit" variant="primary" disabled={savingSettings}>Save</Button>
                <Button type="button" variant="ghost" onClick={() => setSettingsOpen(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
