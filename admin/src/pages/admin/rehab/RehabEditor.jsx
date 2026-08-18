import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, apiUpload } from '../../../api'
import Button from '../../../components/ui/Button'
import Card from '../../../components/ui/Card'
import Badge from '../../../components/ui/Badge'
import InsuranceMultiSelect, {
  OTHER_INSURANCE_NAME,
  insurancePayload as buildInsurancePayload,
  namesFromCenter,
} from '../../../components/InsuranceMultiSelect'
import { toDatetimeLocal, fromDatetimeLocal, getPublicSiteUrl } from '../../../lib/publicSite'
import '../../client/MyCenter.css'

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function listToText(values) {
  return (values || []).join('\n')
}

function textToList(value) {
  return String(value || '')
    .split(/\n|,|;|\|/)
    .map(s => s.trim())
    .filter(Boolean)
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const TABS = [
  ['listing', 'Listing'],
  ['insurance', 'Insurance'],
  ['media', 'Media'],
  ['inquiries', 'Inquiries'],
  ['submissions', 'Submissions'],
]

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
  amenities: '',
  accreditations: '',
  testimonials: '',
  claimed: false,
  contact_visible: false,
  verified_badge: false,
  listing_status: 'draft',
  published_at: '',
}

function formFromCenter(c) {
  return {
    slug: c.slug || '',
    name: c.name || '',
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
    amenities: listToText(c.amenities),
    accreditations: listToText(c.accreditations),
    testimonials: (c.testimonials || []).map(t => (typeof t === 'string' ? t : t.quote || t.text || '')).filter(Boolean).join('\n'),
    claimed: Boolean(c.claimed),
    contact_visible: Boolean(c.contact_visible),
    verified_badge: Boolean(c.verified_badge),
    listing_status: c.listing_status || 'draft',
    published_at: toDatetimeLocal(c.published_at),
  }
}

export default function RehabEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [tab, setTab] = useState('listing')
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(empty)
  const [center, setCenter] = useState(null)
  const [catalog, setCatalog] = useState([])
  const [selectedInsurance, setSelectedInsurance] = useState([])
  const [customInsuranceDraft, setCustomInsuranceDraft] = useState('')
  const [leads, setLeads] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [uploadingHero, setUploadingHero] = useState(false)
  const [uploadingGallery, setUploadingGallery] = useState(false)

  useEffect(() => {
    api('/api/insurances').then(setCatalog).catch(() => setCatalog([]))
  }, [])

  useEffect(() => {
    if (!isEdit) return
    setLoading(true)
    Promise.all([
      api(`/api/admin/rehab-centers/${id}`),
      api('/api/insurances').catch(() => []),
      api(`/api/admin/leads?rehab_center_id=${id}`).catch(() => []),
      api(`/api/admin/center-submissions?rehab_center_id=${id}`).catch(() => []),
    ])
      .then(([c, ins, leadRows, subRows]) => {
        setCenter(c)
        setForm(formFromCenter(c))
        setCatalog(ins || [])
        setSelectedInsurance(namesFromCenter(c.insurances || [], ins || []))
        setLeads(leadRows || [])
        setSubmissions(subRows || [])
      })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  const catalogNameSet = useMemo(
    () => new Set(catalog.map(item => item.name)),
    [catalog],
  )
  const insuranceOptions = useMemo(
    () => catalog.map(item => ({ value: item.name, label: item.name, logo: item.logo_url })),
    [catalog],
  )
  const catalogSelected = useMemo(
    () => selectedInsurance.filter(n => catalogNameSet.has(n)),
    [selectedInsurance, catalogNameSet],
  )
  const customInsurances = useMemo(
    () => selectedInsurance.filter(n => !catalogNameSet.has(n)),
    [selectedInsurance, catalogNameSet],
  )
  const insuranceNames = useMemo(
    () => buildInsurancePayload(selectedInsurance, catalogNameSet),
    [selectedInsurance, catalogNameSet],
  )

  const inquiryInbox = (form.contact_email || form.outreach_email || '').trim()

  function payload() {
    return {
      slug: form.slug,
      name: form.name,
      description: form.description,
      location_display: form.location_display || [form.city, form.state].filter(Boolean).join(', '),
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
      insurances: insuranceNames,
      amenities: textToList(form.amenities),
      accreditations: textToList(form.accreditations),
      testimonials: textToList(form.testimonials).map(quote => ({ quote })),
      claimed: form.claimed,
      contact_visible: form.contact_visible,
      verified_badge: form.verified_badge,
      listing_status: form.listing_status,
      published_at: fromDatetimeLocal(form.published_at),
    }
  }

  async function handleSubmit(e) {
    e?.preventDefault?.()
    setSaving(true)
    setErr('')
    setMsg('')
    try {
      const body = payload()
      if (isEdit) {
        const updated = await api(`/api/admin/rehab-centers/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
        setCenter(c => ({ ...c, ...updated }))
        setMsg('Saved — listing, insurance, and inquiry email are up to date.')
      } else {
        const created = await api('/api/admin/rehab-centers', { method: 'POST', body: JSON.stringify(body) })
        navigate(`/admin/rehab/${created.id}/edit`, { replace: true })
        return
      }
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setSaving(false)
    }
  }

  function setCatalogInsurance(nextCatalogNames) {
    const next = [...nextCatalogNames, ...customInsurances]
    if (
      customInsurances.length > 0
      && !next.some(n => n.toLowerCase() === OTHER_INSURANCE_NAME.toLowerCase())
    ) {
      next.push(OTHER_INSURANCE_NAME)
    }
    setSelectedInsurance(next)
  }

  function addCustomInsurance() {
    const name = customInsuranceDraft.trim()
    if (!name) return
    const exists = selectedInsurance.some(n => n.toLowerCase() === name.toLowerCase())
    if (exists || catalogNameSet.has(name)) {
      if (catalogNameSet.has(name) && !selectedInsurance.includes(name)) {
        setSelectedInsurance(prev => [...prev, name])
      }
      setCustomInsuranceDraft('')
      return
    }
    const otherName = catalog.find(i => i.slug === 'other-insurance' || i.name === OTHER_INSURANCE_NAME)?.name
      || OTHER_INSURANCE_NAME
    setSelectedInsurance(prev => {
      const next = [...prev, name]
      if (!next.some(n => n.toLowerCase() === otherName.toLowerCase())) next.push(otherName)
      return next
    })
    setCustomInsuranceDraft('')
  }

  function removeCustomInsurance(name) {
    setSelectedInsurance(prev => {
      const next = prev.filter(n => n !== name)
      const stillHasCustom = next.some(n => !catalogNameSet.has(n))
      if (!stillHasCustom) {
        return next.filter(n => n.toLowerCase() !== OTHER_INSURANCE_NAME.toLowerCase())
      }
      return next
    })
  }

  async function uploadHero(e) {
    const file = e.target.files?.[0]
    if (!file || !id) return
    setUploadingHero(true)
    setErr('')
    try {
      const result = await apiUpload(`/api/admin/rehab-centers/${id}/hero`, file)
      setCenter(c => ({ ...c, image_key: result.image_key, image_url: result.image_url }))
      setMsg('Hero image updated.')
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setUploadingHero(false)
      e.target.value = ''
    }
  }

  async function uploadGallery(e) {
    const file = e.target.files?.[0]
    if (!file || !id) return
    setUploadingGallery(true)
    setErr('')
    try {
      const result = await apiUpload(`/api/admin/rehab-centers/${id}/gallery`, file)
      setCenter(c => ({
        ...c,
        gallery_keys: result.gallery_keys,
        gallery_urls: result.gallery_urls,
        image_key: result.image_key || c?.image_key,
        image_url: result.image_url || c?.image_url,
      }))
      setMsg('Gallery image added.')
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setUploadingGallery(false)
      e.target.value = ''
    }
  }

  async function deleteGallery(index) {
    if (!id) return
    try {
      const result = await api(`/api/admin/rehab-centers/${id}/gallery/${index}`, { method: 'DELETE' })
      setCenter(c => ({ ...c, gallery_keys: result.gallery_keys, gallery_urls: result.gallery_urls }))
    } catch (ex) {
      setErr(ex.message)
    }
  }

  if (loading) return <p className="muted">Loading…</p>

  const publicPath = center?.slug ? `${getPublicSiteUrl()}/rehab-centers` : null

  return (
    <div className="page-stack mc-page">
      <header className="page-header mc-header">
        <div>
          <p className="eyebrow">{isEdit ? 'Edit center' : 'New center'}</p>
          <h1 className="page-title">{form.name || (isEdit ? 'Edit center' : 'Add center')}</h1>
          <p className="page-sub">
            Same profile fields the provider sees — listing copy, insurance choices, media, and where inquiries are sent.
          </p>
        </div>
        <div className="mc-header-actions">
          <Button variant="ghost" as={Link} to="/admin/rehab">Back to list</Button>
          {isEdit && publicPath && (
            <a className="btn btn-ghost" href={publicPath} target="_blank" rel="noreferrer">Directory</a>
          )}
          <Button variant="primary" type="button" disabled={saving} onClick={handleSubmit}>
            {saving ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </header>

      {err && <p className="error">{err}</p>}
      {msg && <p className="success">{msg}</p>}

      <div className="tabs-row mc-tabs">
        {TABS.map(([idTab, label]) => (
          <button
            key={idTab}
            type="button"
            className={`tab-btn${tab === idTab ? ' active' : ''}`}
            disabled={!isEdit && idTab !== 'listing'}
            onClick={() => setTab(idTab)}
          >
            {label}
            {idTab === 'insurance' && insuranceNames.length > 0 && (
              <span className="tab-count">{insuranceNames.length}</span>
            )}
            {idTab === 'inquiries' && leads.length > 0 && (
              <span className="tab-count">{leads.length}</span>
            )}
            {idTab === 'submissions' && submissions.length > 0 && (
              <span className="tab-count">{submissions.length}</span>
            )}
          </button>
        ))}
      </div>
      {!isEdit && (
        <p className="muted">Save the listing first to edit insurance, media, inquiries, and submissions.</p>
      )}

      {tab === 'listing' && (
        <form id="rehab-form" onSubmit={handleSubmit} className="card card-flat form-stack mc-form">
          <p className="eyebrow">Basics</p>
          <label className="field">
            <span className="field-label">Rehab center name</span>
            <input
              value={form.name}
              onChange={e => {
                const name = e.target.value
                setForm(f => ({ ...f, name, slug: isEdit ? f.slug : slugify(name) }))
              }}
              required
            />
          </label>
          <div className="form-grid-2">
            <label className="field">
              <span className="field-label">Slug</span>
              <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} required disabled={isEdit} />
            </label>
            <label className="field">
              <span className="field-label">Rating</span>
              <input type="number" min={1} max={5} step={0.1} value={form.rating} onChange={e => setForm(f => ({ ...f, rating: e.target.value }))} />
            </label>
          </div>
          <label className="field">
            <span className="field-label">About / description</span>
            <textarea rows={5} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </label>

          <p className="eyebrow">Contact & location</p>
          <div className="form-grid-2">
            {[
              ['address_line', 'Street address', 'text'],
              ['city', 'City', 'text'],
              ['state', 'State', 'text'],
              ['zip', 'ZIP', 'text'],
              ['phone', 'Phone', 'text'],
              ['website', 'Website', 'text'],
              ['verification_url', 'Insurance / benefits verification page URL', 'text'],
              ['google_maps_url', 'Google Map link', 'text'],
            ].map(([key, label, type]) => (
              <label key={key} className={`field${key === 'verification_url' || key === 'google_maps_url' ? ' form-span-2' : ''}`}>
                <span className="field-label">{label}</span>
                <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              </label>
            ))}
          </div>
          <label className="field">
            <span className="field-label">Location display</span>
            <input value={form.location_display} onChange={e => setForm(f => ({ ...f, location_display: e.target.value }))} placeholder="City, State" />
          </label>
          <label className="field">
            <span className="field-label">Google reviews / Maps place link</span>
            <input value={form.google_reviews_url} onChange={e => setForm(f => ({ ...f, google_reviews_url: e.target.value }))} />
          </label>
          <label className="field">
            <span className="field-label">Gallery video URL</span>
            <input value={form.video_url} onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))} />
          </label>

          <p className="eyebrow">Care details</p>
          <div className="form-grid-2">
            {[
              ['specialties', 'Services offered (one per line)'],
              ['levels_of_care', 'Levels of care'],
              ['amenities', 'Amenities'],
              ['accreditations', 'Accreditations'],
            ].map(([key, label]) => (
              <label key={key} className="field">
                <span className="field-label">{label}</span>
                <textarea rows={4} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              </label>
            ))}
          </div>
          <label className="field">
            <span className="field-label">Manual testimonials (one per line)</span>
            <textarea rows={3} value={form.testimonials} onChange={e => setForm(f => ({ ...f, testimonials: e.target.value }))} />
          </label>

          <p className="eyebrow">Publishing</p>
          <div className="form-grid-2">
            <label className="field">
              <span className="field-label">Status</span>
              <select value={form.listing_status} onChange={e => setForm(f => ({ ...f, listing_status: e.target.value }))}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="hidden">Hidden</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">Publish date</span>
              <input type="datetime-local" value={form.published_at} onChange={e => setForm(f => ({ ...f, published_at: e.target.value }))} />
            </label>
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.claimed} onChange={e => setForm(f => ({ ...f, claimed: e.target.checked }))} />
            Claimed listing
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.contact_visible} onChange={e => setForm(f => ({ ...f, contact_visible: e.target.checked }))} />
            Contact visible / premium fields public
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.verified_badge} onChange={e => setForm(f => ({ ...f, verified_badge: e.target.checked }))} />
            Verified badge
          </label>

          <div className="form-actions">
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</Button>
          </div>
        </form>
      )}

      {tab === 'insurance' && (
        <div className="card card-flat mc-insurance">
          <div className="mc-insurance-head">
            <div>
              <p className="eyebrow">USA insurance</p>
              <p className="page-sub" style={{ margin: 0 }}>
                Selected plans appear on the public profile and power the directory insurance filter.
              </p>
            </div>
            <p className="muted">{insuranceNames.length} selected</p>
          </div>

          <label className="field">
            <span className="field-label">Accepted insurance</span>
            <InsuranceMultiSelect
              options={insuranceOptions}
              value={catalogSelected}
              onChange={setCatalogInsurance}
              placeholder="Select insurance plans…"
            />
          </label>

          <div className="mc-custom-insurance">
            <span className="field-label">Custom insurance (Other Insurance)</span>
            <p className="muted" style={{ margin: '4px 0 10px' }}>
              If a plan is not listed, add it here. Custom plans are grouped under Other Insurance.
            </p>
            <div className="mc-custom-insurance-row">
              <input
                type="text"
                value={customInsuranceDraft}
                onChange={e => setCustomInsuranceDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCustomInsurance()
                  }
                }}
                placeholder="e.g. Regional plan name"
              />
              <Button type="button" disabled={!customInsuranceDraft.trim()} onClick={addCustomInsurance}>
                Add
              </Button>
            </div>
            {customInsurances.length > 0 && (
              <div className="mc-multiselect-chips" style={{ marginTop: 10 }}>
                {customInsurances.map(item => (
                  <button
                    key={item}
                    type="button"
                    className="mc-multiselect-chip"
                    onClick={() => removeCustomInsurance(item)}
                    aria-label={`Remove ${item}`}
                  >
                    {item}
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="form-actions">
            <Button type="button" disabled={saving} onClick={handleSubmit}>
              {saving ? 'Saving…' : 'Save insurance'}
            </Button>
          </div>
        </div>
      )}

      {tab === 'media' && (
        <div className="card card-flat form-stack">
          <p className="eyebrow">Media</p>
          <p className="page-sub" style={{ marginTop: 0 }}>
            Same uploads as the provider profile. Images are converted to AVIF.
          </p>
          <div className="field">
            <span className="field-label">Hero / cover image</span>
            {center?.image_url && <img src={center.image_url} alt="" className="mc-hero-preview" />}
            <input type="file" accept="image/*" disabled={uploadingHero} onChange={uploadHero} />
          </div>
          <div className="field">
            <span className="field-label">Gallery images</span>
            <input type="file" accept="image/*" disabled={uploadingGallery} onChange={uploadGallery} />
            {(center?.gallery_urls || []).length > 0 && (
              <div className="mc-gallery">
                {center.gallery_urls.map((url, index) => (
                  <div key={url} className="mc-gallery-item">
                    <img src={url} alt="" />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => deleteGallery(index)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'inquiries' && (
        <div className="page-stack">
          <Card>
            <p className="eyebrow">Where inquiries are sent</p>
            <p className="page-sub">
              Listing form submissions (leads) email this address. Public contact uses the same inbox unless a backup outreach email is set.
            </p>
            <div className="form-grid-2">
              <label className="field">
                <span className="field-label">Send listing inquiries to</span>
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                  placeholder="admissions@example.com"
                />
              </label>
              <label className="field">
                <span className="field-label">Backup / outreach email</span>
                <input
                  type="email"
                  value={form.outreach_email}
                  onChange={e => setForm(f => ({ ...f, outreach_email: e.target.value }))}
                  placeholder="Used if the inquiry inbox is empty"
                />
              </label>
            </div>
            <p className="muted" style={{ marginTop: 8 }}>
              Current inbox: {inquiryInbox || 'None set — listing inquiries will not email anyone.'}
            </p>
            <div className="form-actions">
              <Button type="button" disabled={saving} onClick={handleSubmit}>
                {saving ? 'Saving…' : 'Save inquiry email'}
              </Button>
            </div>
          </Card>

          <Card className="card-pad-0">
            <div className="panel-head">
              <p className="section-title">Listing inquiries</p>
              <Link className="btn btn-ghost btn-sm" to="/admin/leads">All leads</Link>
            </div>
            {leads.length === 0 ? (
              <p className="muted" style={{ padding: 16 }}>No inquiries for this listing yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Message</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map(lead => (
                      <tr key={lead.id}>
                        <td><strong>{lead.full_name}</strong></td>
                        <td>{lead.email || '—'}</td>
                        <td>{lead.phone || '—'}</td>
                        <td>{lead.message || '—'}</td>
                        <td>{formatDate(lead.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'submissions' && (
        <Card className="card-pad-0">
          <div className="panel-head">
            <p className="section-title">Center submissions</p>
            <Link className="btn btn-ghost btn-sm" to="/admin/submissions">Submission Center</Link>
          </div>
          {submissions.length === 0 ? (
            <p className="muted" style={{ padding: 16 }}>No “Submit Your Center” records linked to this listing.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Submitted by</th>
                    <th>Insurance</th>
                    <th>Status</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map(row => (
                    <tr key={row.id}>
                      <td>#{row.id}</td>
                      <td>
                        <strong>{row.full_name}</strong>
                        <div className="muted">{row.email}</div>
                      </td>
                      <td>{(row.insurances || []).join(', ') || '—'}</td>
                      <td><Badge tone={row.status === 'approved' ? 'ok' : row.status === 'rejected' ? 'err' : 'warn'}>{row.status}</Badge></td>
                      <td>{formatDate(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
