import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { toDatetimeLocal, fromDatetimeLocal } from '../../lib/publicSite'

const empty = {
  page_type: 'state',
  state_slug: '',
  city_slug: '',
  title: '',
  body_html: '<p></p>',
  faq_json: '[]',
  meta_title: '',
  meta_description: '',
  filter_state: '',
  filter_city: '',
  filter_insurance: '',
  status: 'draft',
  published_at: '',
}

export default function DirectoryEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(empty)

  useEffect(() => {
    if (!isEdit) return
    setLoading(true)
    api(`/api/admin/directory-pages/${id}`)
      .then(p => setForm({
        page_type: p.page_type,
        state_slug: p.state_slug,
        city_slug: p.city_slug || '',
        title: p.title,
        body_html: p.body_html || '',
        faq_json: JSON.stringify(p.faq_json || [], null, 2),
        meta_title: p.meta_title || '',
        meta_description: p.meta_description || '',
        filter_state: p.filter_state || '',
        filter_city: p.filter_city || '',
        filter_insurance: p.filter_insurance || '',
        status: p.status,
        published_at: toDatetimeLocal(p.published_at),
      }))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      let faq_json = []
      try {
        faq_json = JSON.parse(form.faq_json || '[]')
      } catch {
        alert('FAQ JSON must be valid')
        return
      }
      const body = {
        page_type: form.page_type,
        state_slug: form.state_slug.toLowerCase().trim(),
        city_slug: form.city_slug ? form.city_slug.toLowerCase().trim() : null,
        title: form.title,
        body_html: form.body_html,
        faq_json,
        meta_title: form.meta_title || null,
        meta_description: form.meta_description || null,
        filter_state: form.filter_state || null,
        filter_city: form.filter_city || null,
        filter_insurance: form.filter_insurance || null,
        status: form.status,
        published_at: fromDatetimeLocal(form.published_at),
      }
      if (isEdit) {
        await api(`/api/admin/directory-pages/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
      } else {
        await api('/api/admin/directory-pages', { method: 'POST', body: JSON.stringify(body) })
      }
      navigate('/admin/directory')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="muted">Loading…</p>

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">{isEdit ? 'Edit' : 'New'} directory page</p>
          <h1 className="page-title">{form.title || 'Directory page'}</h1>
        </div>
        <div className="hero-actions">
          <Button variant="ghost" as={Link} to="/admin/directory">Cancel</Button>
          <Button variant="primary" type="submit" form="dir-form" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </header>

      <form id="dir-form" onSubmit={handleSubmit}>
        <Card>
          <div className="form-grid-2">
            <div>
              <label>Type</label>
              <select value={form.page_type} onChange={e => setForm(f => ({ ...f, page_type: e.target.value }))}>
                <option value="state">State pillar</option>
                <option value="city">City cluster</option>
                <option value="topic">Topic</option>
              </select>
            </div>
            <div>
              <label>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div>
              <label>State slug</label>
              <input value={form.state_slug} onChange={e => setForm(f => ({ ...f, state_slug: e.target.value }))} required placeholder="california" />
            </div>
            <div>
              <label>City slug (optional)</label>
              <input value={form.city_slug} onChange={e => setForm(f => ({ ...f, city_slug: e.target.value }))} placeholder="los-angeles" />
            </div>
            <div className="form-span-2">
              <label>Title</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            </div>
            <div className="form-span-2">
              <label>Filter state (display name)</label>
              <input value={form.filter_state} onChange={e => setForm(f => ({ ...f, filter_state: e.target.value }))} placeholder="California" />
            </div>
            <div>
              <label>Filter city</label>
              <input value={form.filter_city} onChange={e => setForm(f => ({ ...f, filter_city: e.target.value }))} />
            </div>
            <div>
              <label>Filter insurance</label>
              <input value={form.filter_insurance} onChange={e => setForm(f => ({ ...f, filter_insurance: e.target.value }))} />
            </div>
            <div className="form-span-2">
              <label>Meta title</label>
              <input value={form.meta_title} onChange={e => setForm(f => ({ ...f, meta_title: e.target.value }))} />
            </div>
            <div className="form-span-2">
              <label>Meta description</label>
              <textarea rows={2} value={form.meta_description} onChange={e => setForm(f => ({ ...f, meta_description: e.target.value }))} />
            </div>
            <div className="form-span-2">
              <label>Body HTML</label>
              <textarea rows={12} value={form.body_html} onChange={e => setForm(f => ({ ...f, body_html: e.target.value }))} />
            </div>
            <div className="form-span-2">
              <label>FAQ JSON</label>
              <textarea rows={6} value={form.faq_json} onChange={e => setForm(f => ({ ...f, faq_json: e.target.value }))} placeholder='[{"question":"…","answer":"…"}]' />
            </div>
            <div>
              <label>Publish date</label>
              <input type="datetime-local" value={form.published_at} onChange={e => setForm(f => ({ ...f, published_at: e.target.value }))} />
            </div>
          </div>
        </Card>
      </form>
    </div>
  )
}
