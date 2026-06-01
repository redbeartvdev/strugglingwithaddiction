import { useEffect, useState } from 'react'
import { api } from '../../api'

export default function ClientLanding() {
  const [form, setForm] = useState({ headline: '', about_html: '', is_published: false, meta_title: '', meta_description: '' })
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api('/api/client/landing').then(d => setForm({
      headline: d.headline || '',
      about_html: d.about_html || '',
      is_published: d.is_published || false,
      meta_title: d.meta_title || '',
      meta_description: d.meta_description || '',
    }))
  }, [])

  async function save(e) {
    e.preventDefault()
    await api('/api/client/landing', { method: 'PATCH', body: JSON.stringify(form) })
    setMsg('Saved.')
  }

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Landing.</h1>
      </header>
      {msg && <p className="success">{msg}</p>}
      <form className="card card-flat" onSubmit={save}>
        <label>Headline</label>
        <input value={form.headline} onChange={e => setForm(f => ({ ...f, headline: e.target.value }))} />
        <label>About</label>
        <textarea rows={5} value={form.about_html} onChange={e => setForm(f => ({ ...f, about_html: e.target.value }))} />
        <label className="checkbox-row">
          <input type="checkbox" checked={form.is_published} onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))} />
          Published
        </label>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">Save</button>
        </div>
      </form>
    </div>
  )
}
