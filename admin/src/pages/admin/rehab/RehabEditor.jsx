import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../../api'
import Button from '../../../components/ui/Button'
import Card from '../../../components/ui/Card'
import { toDatetimeLocal, fromDatetimeLocal } from '../../../lib/publicSite'

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const empty = {
  slug: '',
  name: '',
  description: '',
  location_display: '',
  address_line: '',
  city: '',
  state: '',
  zip: '',
  phone: '',
  website: '',
  rating: 5,
  specialties: '',
  listing_status: 'draft',
  published_at: '',
  listing_tier: 'free',
  is_sponsored: false,
  insurance_accepted: '',
  treatment_levels: '',
  external_id: '',
}

export default function RehabEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(empty)

  useEffect(() => {
    if (!isEdit) return
    setLoading(true)
    api(`/api/admin/rehab-centers/${id}`)
      .then(c => setForm({
        slug: c.slug,
        name: c.name,
        description: c.description || '',
        location_display: c.location_display || '',
        address_line: c.address_line || '',
        city: c.city || '',
        state: c.state || '',
        zip: c.zip || '',
        phone: c.phone || '',
        website: c.website || '',
        rating: c.rating ?? 5,
        specialties: (c.specialties || []).join(', '),
        listing_status: c.listing_status,
        published_at: toDatetimeLocal(c.published_at),
        listing_tier: c.listing_tier || 'free',
        is_sponsored: Boolean(c.is_sponsored),
        insurance_accepted: (c.insurance_accepted || []).join(', '),
        treatment_levels: (c.treatment_levels || []).join(', '),
        external_id: c.external_id || '',
      }))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = {
        slug: form.slug,
        name: form.name,
        description: form.description,
        location_display: form.location_display,
        address_line: form.address_line || null,
        city: form.city || null,
        state: form.state || null,
        zip: form.zip || null,
        phone: form.phone || null,
        website: form.website || null,
        rating: Number(form.rating),
        specialties: form.specialties.split(',').map(s => s.trim()).filter(Boolean),
        listing_status: form.listing_status,
        published_at: fromDatetimeLocal(form.published_at),
        listing_tier: form.listing_tier,
        is_sponsored: form.is_sponsored,
        insurance_accepted: form.insurance_accepted.split(',').map(s => s.trim()).filter(Boolean),
        treatment_levels: form.treatment_levels.split(',').map(s => s.trim()).filter(Boolean),
        external_id: form.external_id || null,
      }
      if (isEdit) {
        await api(`/api/admin/rehab-centers/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
      } else {
        await api('/api/admin/rehab-centers', { method: 'POST', body: JSON.stringify(body) })
      }
      navigate('/admin/rehab')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="muted">Loading…</p>

  return (
    <div className="page-stack post-editor-layout">
      <header className="page-header post-editor-header">
        <div>
          <p className="eyebrow">{isEdit ? 'Edit center' : 'New center'}</p>
          <h1 className="page-title">{isEdit ? 'Edit center' : 'Add center'}</h1>
        </div>
        <div className="hero-actions">
          <Button variant="ghost" as={Link} to="/admin/rehab">Cancel</Button>
          <Button variant="primary" type="submit" form="rehab-form" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </header>

      <form id="rehab-form" onSubmit={handleSubmit} className="post-editor-column">
        <Card>
          <div className="form-grid-2">
            <div className="form-span-2">
              <label>Name</label>
              <input
                value={form.name}
                onChange={e => {
                  const name = e.target.value
                  setForm(f => ({ ...f, name, slug: isEdit ? f.slug : slugify(name) }))
                }}
                required
              />
            </div>
            <div>
              <label>Slug</label>
              <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} required disabled={isEdit} />
            </div>
            <div>
              <label>Rating</label>
              <input type="number" min={1} max={5} step={0.1} value={form.rating} onChange={e => setForm(f => ({ ...f, rating: e.target.value }))} />
            </div>
            <div className="form-span-2">
              <label>Location display</label>
              <input value={form.location_display} onChange={e => setForm(f => ({ ...f, location_display: e.target.value }))} placeholder="City, State" />
            </div>
            <div className="form-span-2">
              <label>Address</label>
              <input value={form.address_line} onChange={e => setForm(f => ({ ...f, address_line: e.target.value }))} />
            </div>
            <div><label>City</label><input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
            <div><label>State</label><input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} /></div>
            <div><label>Phone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div><label>Website</label><input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://…" /></div>
            <div>
              <label>Status</label>
              <select value={form.listing_status} onChange={e => setForm(f => ({ ...f, listing_status: e.target.value }))}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
            <div>
              <label>Publish date</label>
              <input type="datetime-local" value={form.published_at} onChange={e => setForm(f => ({ ...f, published_at: e.target.value }))} />
            </div>
            <div>
              <label>Listing tier</label>
              <select value={form.listing_tier} onChange={e => setForm(f => ({ ...f, listing_tier: e.target.value }))}>
                <option value="free">Free</option>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label>Sponsored listing</label>
              <select value={form.is_sponsored ? 'yes' : 'no'} onChange={e => setForm(f => ({ ...f, is_sponsored: e.target.value === 'yes' }))}>
                <option value="no">No</option>
                <option value="yes">Yes (paid ad)</option>
              </select>
            </div>
            <div className="form-span-2">
              <label>SAMHSA / external ID</label>
              <input value={form.external_id} onChange={e => setForm(f => ({ ...f, external_id: e.target.value }))} />
            </div>
            <div className="form-span-2">
              <label>Services (comma-separated)</label>
              <input value={form.specialties} onChange={e => setForm(f => ({ ...f, specialties: e.target.value }))} placeholder="Inpatient, Detox, Dual Diagnosis" />
            </div>
            <div className="form-span-2">
              <label>Insurance accepted</label>
              <input value={form.insurance_accepted} onChange={e => setForm(f => ({ ...f, insurance_accepted: e.target.value }))} placeholder="Medicaid, Private Insurance" />
            </div>
            <div className="form-span-2">
              <label>Treatment levels</label>
              <input value={form.treatment_levels} onChange={e => setForm(f => ({ ...f, treatment_levels: e.target.value }))} placeholder="Detox, Inpatient, Outpatient" />
            </div>
            <div className="form-span-2">
              <label>Description</label>
              <textarea rows={5} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
        </Card>
      </form>
    </div>
  )
}
