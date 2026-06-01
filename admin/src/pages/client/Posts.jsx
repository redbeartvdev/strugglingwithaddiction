import { useEffect, useState } from 'react'
import { api } from '../../api'

const empty = { slug: '', title: '', excerpt: '', content_html: '', status: 'draft' }

export default function ClientPosts() {
  const [posts, setPosts] = useState([])
  const [form, setForm] = useState(empty)

  const load = () => api('/api/client/posts').then(setPosts)
  useEffect(() => { load() }, [])

  async function create(e) {
    e.preventDefault()
    await api('/api/client/posts', { method: 'POST', body: JSON.stringify(form) })
    setForm(empty)
    load()
  }

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Posts.</h1>
      </header>
      <form className="card card-flat" onSubmit={create}>
        <label>Slug</label>
        <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} required />
        <label>Title</label>
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
        <label>Content</label>
        <textarea rows={4} value={form.content_html} onChange={e => setForm(f => ({ ...f, content_html: e.target.value }))} />
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">Create</button>
        </div>
      </form>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Title</th><th>Status</th></tr></thead>
          <tbody>{posts.map(p => <tr key={p.id}><td>{p.title}</td><td><span className="badge">{p.status}</span></td></tr>)}</tbody>
        </table>
      </div>
    </div>
  )
}
