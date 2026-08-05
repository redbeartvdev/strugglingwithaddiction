import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../../api'
import Button from '../../../components/ui/Button'
import Card from '../../../components/ui/Card'
import { toDatetimeLocal, fromDatetimeLocal } from '../../../lib/publicSite'

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function listToText(values) {
  return (values || []).join(', ')
}

function textToList(value) {
  return String(value || '').split(',').map(s => s.trim()).filter(Boolean)
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
  verification_url: '',
  contact_email: '',
  outreach_email: '',
  google_maps_url: '',
  google_reviews_url: '',
  video_url: '',
  rating: 5,
  specialties: '',
  levels_of_care: '',
  insurances: '',
  amenities: '',
  accreditations: '',
  testimonials: '',
  claimed: false,
  contact_visible: false,
  verified_badge: false,
  listing_status: 'draft',
  published_at: '',
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
        verification_url: c.verification_url || '',
        contact_email: c.contact_email || '',
        outreach_email: c.outreach_email || '',
        google_maps_url: c.google_maps_url || '',
        google_reviews_url: c.google_reviews_url || '',
        video_url: c.video_url || '',
        rating: c.rating ?? 5,
        specialties: listToText(c.specialties),
        levels_of_care: listToText(c.levels_of_care),
        insurances: listToText(c.insurances),
        amenities: listToText(c.amenities),
        accreditations: listToText(c.accreditations),
        testimonials: (c.testimonials || []).map(t => (typeof t === 'string' ? t : t.quote || t.text || '')).filter(Boolean).join('\n'),
        claimed: Boolean(c.claimed),
        contact_visible: Boolean(c.contact_visible),
        verified_badge: Boolean(c.verified_badge),
        listing_status: c.listing_status,
        published_at: toDatetimeLocal(c.published_at),
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
        verification_url: form.verification_url || null,
        contact_email: form.contact_email || null,
        outreach_email: form.outreach_email || null,
        google_maps_url: form.google_maps_url || null,
        google_reviews_url: form.google_reviews_url || null,
        video_url: form.video_url || null,
        rating: Number(form.rating),
        specialties: textToList(form.specialties),
        levels_of_care: textToList(form.levels_of_care),
        insurances: textToList(form.insurances),
        amenities: textToList(form.amenities),
        accreditations: textToList(form.accreditations),
        testimonials: String(form.testimonials || '').split('\n').map(s => s.trim()).filter(Boolean).map(quote => ({ quote })),
        claimed: form.claimed,
        contact_visible: form.contact_visible,
        verified_badge: form.verified_badge,
        listing_status: form.listing_status,
        published_at: fromDatetimeLocal(form.published_at),
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
              <label>Rehab center name</label>
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
              <label>Complete address</label>
              <input value={form.address_line} onChange={e => setForm(f => ({ ...f, address_line: e.target.value }))} />
            </div>
            <div><label>City</label><input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
            <div><label>State</label><input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} /></div>
            <div><label>ZIP</label><input value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} /></div>
            <div><label>Phone number</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div><label>Website link</label><input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://…" /></div>
            <div className="form-span-2"><label>Insurance / benefits verification page URL</label><input value={form.verification_url} onChange={e => setForm(f => ({ ...f, verification_url: e.target.value }))} placeholder="https://… (optional deep link for directory CTA)" /></div>
            <div><label>Contact email</label><input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} /></div>
            <div><label>Outreach email</label><input value={form.outreach_email} onChange={e => setForm(f => ({ ...f, outreach_email: e.target.value }))} /></div>
            <div className="form-span-2"><label>Google Map link</label><input value={form.google_maps_url} onChange={e => setForm(f => ({ ...f, google_maps_url: e.target.value }))} /></div>
            <div className="form-span-2"><label>Google reviews</label><input value={form.google_reviews_url} onChange={e => setForm(f => ({ ...f, google_reviews_url: e.target.value }))} /></div>
            <div className="form-span-2"><label>Gallery video URL</label><input value={form.video_url} onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))} /></div>
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
            <div className="form-span-2">
              <label>Services offered (comma-separated)</label>
              <input value={form.specialties} onChange={e => setForm(f => ({ ...f, specialties: e.target.value }))} />
            </div>
            <div className="form-span-2">
              <label>Levels of care (comma-separated)</label>
              <input value={form.levels_of_care} onChange={e => setForm(f => ({ ...f, levels_of_care: e.target.value }))} />
            </div>
            <div className="form-span-2">
              <label>Insurances accepted (comma-separated)</label>
              <input value={form.insurances} onChange={e => setForm(f => ({ ...f, insurances: e.target.value }))} />
            </div>
            <div className="form-span-2">
              <label>Amenities (comma-separated)</label>
              <input value={form.amenities} onChange={e => setForm(f => ({ ...f, amenities: e.target.value }))} />
            </div>
            <div className="form-span-2">
              <label>Accreditations (comma-separated)</label>
              <input value={form.accreditations} onChange={e => setForm(f => ({ ...f, accreditations: e.target.value }))} />
            </div>
            <div className="form-span-2">
              <label>Testimonials (one per line)</label>
              <textarea rows={4} value={form.testimonials} onChange={e => setForm(f => ({ ...f, testimonials: e.target.value }))} />
            </div>
            <div className="form-span-2">
              <label>Description & more</label>
              <textarea rows={5} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <label><input type="checkbox" checked={form.claimed} onChange={e => setForm(f => ({ ...f, claimed: e.target.checked }))} /> Claimed listing</label>
            <label><input type="checkbox" checked={form.contact_visible} onChange={e => setForm(f => ({ ...f, contact_visible: e.target.checked }))} /> Contact visible / premium fields public</label>
            <label><input type="checkbox" checked={form.verified_badge} onChange={e => setForm(f => ({ ...f, verified_badge: e.target.checked }))} /> Verified badge</label>
          </div>
        </Card>
      </form>
    </div>
  )
}
