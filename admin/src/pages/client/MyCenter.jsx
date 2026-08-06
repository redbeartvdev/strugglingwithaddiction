import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, apiUpload } from '../../api'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import './MyCenter.css'

function listToText(arr) {
  return (arr || []).join('\n')
}

function textToList(text) {
  return String(text || '')
    .split(/\n|,|;|\|/)
    .map(s => s.trim())
    .filter(Boolean)
}

const OTHER_INSURANCE_NAME = 'Other Insurance'

const RANGE_OPTIONS = [
  ['1h', '1 hour'],
  ['12h', '12 hours'],
  ['today', 'Today'],
  ['week', 'Week'],
  ['month', 'Month'],
  ['year', 'Year'],
  ['custom', 'Date range'],
]

const TABS = [
  ['overview', 'Overview'],
  ['listing', 'Listing'],
  ['insurance', 'Insurance'],
  ['media', 'Media'],
  ['analytics', 'Analytics'],
]

function InsuranceMultiSelect({ options, value, onChange, disabled, placeholder = 'Select insurance…' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(opt => opt.label.toLowerCase().includes(q))
  }, [options, query])

  function toggle(optValue) {
    if (disabled) return
    onChange(
      value.includes(optValue)
        ? value.filter(n => n !== optValue)
        : [...value, optValue],
    )
  }

  function remove(optValue) {
    if (disabled) return
    onChange(value.filter(n => n !== optValue))
  }

  const summary = value.length === 0
    ? placeholder
    : value.length === 1
      ? value[0]
      : `${value.length} selected`

  return (
    <div className={`mc-multiselect${disabled ? ' is-disabled' : ''}`} ref={rootRef}>
      <button
        type="button"
        className={`mc-multiselect-trigger${open ? ' is-open' : ''}${value.length ? ' has-value' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
      >
        <span>{summary}</span>
        <span className="mc-multiselect-caret" aria-hidden="true" />
      </button>

      {value.length > 0 && (
        <div className="mc-multiselect-chips">
          {value.map(item => (
            <button
              key={item}
              type="button"
              className="mc-multiselect-chip"
              disabled={disabled}
              onClick={() => remove(item)}
              aria-label={`Remove ${item}`}
            >
              {item}
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}

      {open && !disabled && (
        <div className="mc-multiselect-panel" role="listbox" aria-multiselectable="true">
          <input
            type="search"
            className="mc-multiselect-search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search insurance…"
            autoFocus
            aria-label="Search insurance"
          />
          <div className="mc-multiselect-options">
            {filtered.length === 0 ? (
              <p className="mc-multiselect-empty">No matches</p>
            ) : (
              filtered.map(opt => {
                const selected = value.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`mc-multiselect-option${selected ? ' is-on' : ''}`}
                    onClick={() => toggle(opt.value)}
                  >
                    {opt.logo && <img src={opt.logo} alt="" className="mc-multiselect-logo" />}
                    <span>{opt.label}</span>
                    <span className="mc-multiselect-check" aria-hidden="true">{selected ? '✓' : ''}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, hint }) {
  return (
    <div className="mc-stat">
      <p className="mc-stat-label">{label}</p>
      <p className="mc-stat-value">{value}</p>
      {hint && <p className="mc-stat-hint">{hint}</p>}
    </div>
  )
}

function AnalyticsPanel({ locked }) {
  const [range, setRange] = useState('today')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (locked) {
      setLoading(false)
      return
    }
    const params = new URLSearchParams()
    if (range === 'custom') {
      if (!dateFrom || !dateTo) return
      params.set('date_from', new Date(dateFrom).toISOString())
      params.set('date_to', new Date(`${dateTo}T23:59:59`).toISOString())
    } else {
      params.set('range', range)
    }
    setLoading(true)
    setErr('')
    api(`/api/client/analytics?${params}`)
      .then(setData)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }, [range, dateFrom, dateTo, locked])

  if (locked) {
    return <p className="muted">Activate your subscription to unlock listing analytics.</p>
  }

  const maxBar = Math.max(1, ...(data?.series || []).map(s => Math.max(s.views, s.leads)))

  return (
    <div className="mc-analytics">
      <div className="mc-range-row">
        <div className="tabs-row mc-range-tabs">
          {RANGE_OPTIONS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`tab-btn${range === id ? ' active' : ''}`}
              onClick={() => setRange(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="mc-date-range">
            <label>
              From
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </label>
            <label>
              To
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </label>
          </div>
        )}
      </div>

      {err && <p className="form-error">{err}</p>}
      {loading && <p className="muted">Loading analytics…</p>}

      {!loading && data && (
        <>
          <div className="mc-stat-grid">
            <StatCard label="Profile visits" value={data.summary.page_views} hint={`${data.summary.unique_sessions} unique sessions`} />
            <StatCard label="Leads" value={data.summary.leads} hint={`${data.summary.unread_leads} unread`} />
            <StatCard label="Conversion" value={`${data.summary.conversion_rate}%`} hint="Leads ÷ visits" />
          </div>

          <div className="mc-analytics-grid">
            <Card>
              <p className="eyebrow">Visits & leads over time</p>
              <div className="mc-bars">
                {(data.series || []).length === 0 && <p className="muted">No activity in this range yet.</p>}
                {(data.series || []).map(row => (
                  <div key={row.label} className="mc-bar-row">
                    <span className="mc-bar-label">{row.label}</span>
                    <div className="mc-bar-tracks">
                      <div className="mc-bar mc-bar-views" style={{ width: `${(row.views / maxBar) * 100}%` }} title={`${row.views} visits`} />
                      <div className="mc-bar mc-bar-leads" style={{ width: `${(row.leads / maxBar) * 100}%` }} title={`${row.leads} leads`} />
                    </div>
                    <span className="mc-bar-nums">{row.views} / {row.leads}</span>
                  </div>
                ))}
              </div>
              <p className="muted mc-legend"><span className="mc-dot views" /> Visits <span className="mc-dot leads" /> Leads</p>
            </Card>

            <Card>
              <p className="eyebrow">Visitor states</p>
              {(data.by_state || []).length === 0 && <p className="muted">No state data yet.</p>}
              <ul className="mc-rank-list">
                {(data.by_state || []).map(row => (
                  <li key={row.state}>
                    <span>{row.state}</span>
                    <strong>{row.views} visits</strong>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <p className="eyebrow">Devices</p>
              {(data.by_device || []).length === 0 && <p className="muted">No device data yet.</p>}
              <ul className="mc-rank-list">
                {(data.by_device || []).map(row => (
                  <li key={row.device}>
                    <span className="mc-device-cap">{row.device}</span>
                    <strong>{row.views}</strong>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <p className="eyebrow">Recent leads</p>
              {(data.recent_leads || []).length === 0 && <p className="muted">No leads in this range.</p>}
              <ul className="mc-rank-list">
                {(data.recent_leads || []).map(lead => (
                  <li key={lead.id}>
                    <span>{lead.full_name}</span>
                    <strong>{lead.read_at ? 'Read' : 'New'}</strong>
                  </li>
                ))}
              </ul>
              <Link className="btn btn-ghost btn-sm" to="/client/leads" style={{ marginTop: 12 }}>Open leads inbox</Link>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

export default function ClientMyCenter() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = TABS.some(([id]) => id === searchParams.get('tab')) ? searchParams.get('tab') : 'overview'
  const [tab, setTab] = useState(initialTab)
  const [center, setCenter] = useState(null)
  const [form, setForm] = useState(null)
  const [catalog, setCatalog] = useState([])
  const [selectedInsurance, setSelectedInsurance] = useState([])
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingGallery, setUploadingGallery] = useState(false)
  const [uploadingHero, setUploadingHero] = useState(false)
  const [customInsuranceDraft, setCustomInsuranceDraft] = useState('')

  useEffect(() => {
    const next = searchParams.get('tab')
    if (next && TABS.some(([id]) => id === next) && next !== tab) {
      setTab(next)
    }
  }, [searchParams, tab])

  function selectTab(id) {
    setTab(id)
    setSearchParams(id === 'overview' ? {} : { tab: id }, { replace: true })
  }

  useEffect(() => {
    Promise.all([
      api('/api/client/my-center'),
      api('/api/insurances').catch(() => []),
    ]).then(([c, ins]) => {
      setCenter(c)
      setCatalog(ins || [])
      if (c) {
        setForm({
          name: c.name || '',
          description: c.description || '',
          address_line: c.address_line || '',
          city: c.city || '',
          state: c.state || '',
          zip: c.zip || '',
          phone: c.phone || '',
          website: c.website || '',
          verification_url: c.verification_url || '',
          contact_email: c.contact_email || '',
          google_maps_url: c.google_maps_url || '',
          google_reviews_url: c.google_reviews_url || '',
          specialties: listToText(c.specialties),
          levels_of_care: listToText(c.levels_of_care),
          amenities: listToText(c.amenities),
          accreditations: listToText(c.accreditations),
          testimonials: (c.testimonials || []).map(t => (typeof t === 'string' ? t : t?.quote || '')).join('\n'),
        })
        const names = c.insurances || []
        const catalogNames = new Set((ins || []).map(i => i.name.toLowerCase()))
        const matched = (ins || [])
          .filter(i => names.some(n => n.toLowerCase() === i.name.toLowerCase()
            || n.toLowerCase().replace(/[-_]/g, ' ') === i.slug.replace(/-/g, ' ')))
          .map(i => i.name)
        const custom = names.filter(n => !catalogNames.has(n.toLowerCase())
          && !matched.some(m => m.toLowerCase() === n.toLowerCase()))
        const merged = [...matched, ...custom]
        if (custom.length > 0 && !merged.some(n => n.toLowerCase() === OTHER_INSURANCE_NAME.toLowerCase())) {
          const other = (ins || []).find(i => i.name === OTHER_INSURANCE_NAME || i.slug === 'other-insurance')
          if (other) merged.push(other.name)
          else merged.push(OTHER_INSURANCE_NAME)
        }
        setSelectedInsurance(merged)
      }
    }).catch(() => setCenter(null))
  }, [])

  const locked = center?.dashboard_locked

  const catalogNameSet = useMemo(
    () => new Set(catalog.map(item => item.name)),
    [catalog],
  )

  const insuranceOptions = useMemo(
    () => catalog.map(item => ({
      value: item.name,
      label: item.name,
      logo: item.logo_url,
    })),
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

  const insurancePayload = useMemo(() => {
    const names = selectedInsurance.filter(Boolean)
    const hasCustom = names.some(n => !catalogNameSet.has(n))
    if (hasCustom && !names.some(n => n.toLowerCase() === OTHER_INSURANCE_NAME.toLowerCase())) {
      return [...names, OTHER_INSURANCE_NAME]
    }
    return names
  }, [selectedInsurance, catalogNameSet])

  async function save(e) {
    e?.preventDefault?.()
    if (!form || locked) return
    setSaving(true)
    setErr('')
    setMsg('')
    try {
      const body = {
        ...form,
        video_url: '',
        specialties: textToList(form.specialties),
        insurances: insurancePayload,
        levels_of_care: textToList(form.levels_of_care),
        amenities: textToList(form.amenities),
        accreditations: textToList(form.accreditations),
        testimonials: textToList(form.testimonials).map(quote => ({ quote })),
      }
      await api('/api/client/my-center', { method: 'PATCH', body: JSON.stringify(body) })
      const refreshed = await api('/api/client/my-center')
      setCenter(refreshed || center)
      setMsg('Saved — changes are live on your public listing.')
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
    if (!file) return
    setUploadingHero(true)
    setErr('')
    try {
      const result = await apiUpload('/api/client/my-center/hero', file)
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
    if (!file) return
    setUploadingGallery(true)
    setErr('')
    try {
      const result = await apiUpload('/api/client/my-center/gallery', file)
      setCenter(c => ({
        ...c,
        gallery_keys: result.gallery_keys,
        gallery_urls: result.gallery_urls,
        image_key: result.image_key || c.image_key,
        image_url: result.image_url || c.image_url,
      }))
      setMsg('Gallery image uploaded.')
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setUploadingGallery(false)
      e.target.value = ''
    }
  }

  async function deleteGallery(index) {
    try {
      const result = await api(`/api/client/my-center/gallery/${index}`, { method: 'DELETE' })
      setCenter(c => ({ ...c, gallery_keys: result.gallery_keys, gallery_urls: result.gallery_urls }))
    } catch (ex) {
      setErr(ex.message)
    }
  }

  if (center === null) {
    return (
      <div className="page-stack">
        <header className="page-header">
          <h1 className="page-title">Profile.</h1>
        </header>
        <p className="card card-flat muted">No center linked. Claim a listing on the public site, verify certification, then subscribe.</p>
      </div>
    )
  }

  if (!form) return <p className="muted">Loading…</p>

  const pct = center.completeness?.percent ?? 0
  const onboarding = [
    ['Write your description', Boolean(form.description?.trim())],
    ['Add services and levels of care', Boolean(form.specialties?.trim() && form.levels_of_care?.trim())],
    ['Select accepted insurance', insurancePayload.length > 0],
    ['Add a hero or gallery image', Boolean(center.image_url || center.gallery_keys?.length)],
  ]

  return (
    <div className="page-stack mc-page">
      <header className="page-header mc-header">
        <div>
          <h1 className="page-title">Profile.</h1>
          <p className="page-sub">Manage your public listing, insurance, media, and visitor analytics in one place.</p>
        </div>
        <div className="mc-header-actions">
          {center.public_listing_url && (
            <a className="btn btn-primary" href={center.public_listing_url} target="_blank" rel="noreferrer">
              View listing
            </a>
          )}
          <Button type="button" disabled={saving || locked} onClick={save}>
            {saving ? 'Saving…' : 'Save & publish'}
          </Button>
        </div>
      </header>

      {locked && (
        <Card>
          <p><strong>Dashboard locked.</strong> Your subscription is inactive. Only billing and resubscribe remain available.</p>
          <Button type="button" onClick={() => { window.location.href = '/client/billing' }}>Go to billing</Button>
        </Card>
      )}

      <div className="mc-summary-card card card-flat">
        <div>
          <p className="eyebrow">Public listing</p>
          <h2 className="mc-center-name">{center.name}</h2>
          <div className="mc-badge-row">
            {center.verified_badge && <span className="badge">Verified badge</span>}
            {center.featured_active && <span className="badge">Featured</span>}
            {!center.verified_badge && !center.featured_active && (
              <span className="muted">No upgrades active yet</span>
            )}
          </div>
        </div>
        <div className="mc-complete">
          <div className="mc-complete-ring" style={{ '--pct': pct }}>
            <span>{pct}%</span>
          </div>
          <p className="muted">Profile completeness</p>
        </div>
      </div>

      <div className="tabs-row mc-tabs">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`tab-btn${tab === id ? ' active' : ''}`}
            onClick={() => selectTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {err && <p className="form-error">{err}</p>}
      {msg && <p className="success">{msg}</p>}

      {tab === 'overview' && (
        <div className="mc-overview">
          <Card>
            <p className="eyebrow">Get listing-ready</p>
            <ul className="mc-checklist">
              {onboarding.map(([label, complete]) => (
                <li key={label} className={complete ? 'is-done' : ''}>
                  <span aria-hidden="true">{complete ? '✓' : '○'}</span>
                  {label}
                </li>
              ))}
            </ul>
            <div className="mc-quick-links">
              <button type="button" className="btn btn-ghost" onClick={() => selectTab('listing')}>Edit listing</button>
              <button type="button" className="btn btn-ghost" onClick={() => selectTab('insurance')}>Choose insurance</button>
              <button type="button" className="btn btn-ghost" onClick={() => selectTab('analytics')}>View analytics</button>
              <Link className="btn btn-ghost" to="/client/upsells">Upgrade visibility</Link>
            </div>
          </Card>
          <Card>
            <p className="eyebrow">Snapshot</p>
            <ul className="mc-rank-list">
              <li><span>Selected insurance plans</span><strong>{insurancePayload.length}</strong></li>
              <li><span>Gallery images</span><strong>{(center.gallery_urls || []).length}</strong></li>
              <li><span>Contact phone</span><strong>{form.phone || '—'}</strong></li>
              <li><span>City / state</span><strong>{[form.city, form.state].filter(Boolean).join(', ') || '—'}</strong></li>
            </ul>
          </Card>
        </div>
      )}

      {tab === 'listing' && (
        <form className="card card-flat form-stack mc-form" onSubmit={save}>
          <p className="eyebrow">Basics</p>
          <label className="field">
            <span className="field-label">Rehab center name</span>
            <input disabled={locked} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </label>
          <label className="field">
            <span className="field-label">About / description</span>
            <textarea rows={5} disabled={locked} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
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
              ['contact_email', 'Contact email', 'email'],
              ['google_maps_url', 'Google Map link', 'text'],
            ].map(([key, label, type]) => (
              <label key={key} className={`field${key === 'verification_url' ? ' form-span-2' : ''}`}>
                <span className="field-label">{label}</span>
                <input type={type} disabled={locked} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={key === 'verification_url' ? 'https://… (optional — used for directory Visit Website CTA)' : undefined} />
              </label>
            ))}
          </div>

          <label className="field">
            <span className="field-label">Google reviews / Maps place link</span>
            <input
              type="text"
              disabled={locked}
              value={form.google_reviews_url}
              onChange={e => setForm(f => ({ ...f, google_reviews_url: e.target.value }))}
              placeholder="Paste your Google Business / Maps place URL"
            />
            <p className="muted" style={{ marginTop: 6 }}>
              Paste your Google Maps or Google Business Profile link. When configured, your public landing page pulls live Google review feeds automatically. Manual testimonials below are used as a fallback.
            </p>
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
                <textarea rows={4} disabled={locked} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              </label>
            ))}
          </div>
          <label className="field">
            <span className="field-label">Manual testimonials (one per line — fallback if Google feed is unavailable)</span>
            <textarea rows={3} disabled={locked} value={form.testimonials} onChange={e => setForm(f => ({ ...f, testimonials: e.target.value }))} />
          </label>

          <div className="form-actions">
            <Button type="submit" disabled={saving || locked}>{saving ? 'Saving…' : 'Save & publish'}</Button>
          </div>
        </form>
      )}

      {tab === 'insurance' && (
        <div className="card card-flat mc-insurance">
          <div className="mc-insurance-head">
            <div>
              <p className="eyebrow">USA insurance</p>
              <p className="page-sub" style={{ margin: 0 }}>
                Select the plans you accept. Logos appear on your landing page and power the directory insurance filter.
              </p>
            </div>
            <p className="muted">{insurancePayload.length} selected</p>
          </div>

          <label className="field">
            <span className="field-label">Accepted insurance</span>
            <InsuranceMultiSelect
              options={insuranceOptions}
              value={catalogSelected}
              onChange={setCatalogInsurance}
              disabled={locked}
              placeholder="Select insurance plans…"
            />
          </label>

          <div className="mc-custom-insurance">
            <span className="field-label">Custom insurance (Other Insurance)</span>
            <p className="muted" style={{ margin: '4px 0 10px' }}>
              If your plan is not listed, add it here. Custom plans are grouped under Other Insurance for directory filtering.
            </p>
            <div className="mc-custom-insurance-row">
              <input
                type="text"
                disabled={locked}
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
              <Button type="button" disabled={locked || !customInsuranceDraft.trim()} onClick={addCustomInsurance}>
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
                    disabled={locked}
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
            <Button type="button" disabled={saving || locked} onClick={save}>
              {saving ? 'Saving…' : 'Save insurance'}
            </Button>
          </div>
        </div>
      )}

      {tab === 'media' && (
        <div className="card card-flat form-stack">
          <p className="eyebrow">Media</p>
          <p className="page-sub" style={{ marginTop: 0 }}>
            Images only — uploads are converted to AVIF for faster landing pages.
          </p>

          <div className="field">
            <span className="field-label">Hero / cover image</span>
            {center.image_url && (
              <img src={center.image_url} alt="" className="mc-hero-preview" />
            )}
            <input type="file" accept="image/*" disabled={locked || uploadingHero} onChange={uploadHero} />
            <p className="muted">Shown in the landing hero and directory card. Converted to AVIF on upload.</p>
          </div>

          <div className="field">
            <span className="field-label">Gallery images</span>
            <input type="file" accept="image/*" disabled={locked || uploadingGallery} onChange={uploadGallery} />
            <p className="muted">Upload up to 12 images, 8MB each. Each file is converted to AVIF.</p>
            {(center.gallery_urls || []).length > 0 && (
              <div className="mc-gallery">
                {center.gallery_urls.map((url, index) => (
                  <div key={url} className="mc-gallery-item">
                    <img src={url} alt="" />
                    {!locked && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => deleteGallery(index)}>
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-actions">
            <Button type="button" disabled={saving || locked} onClick={save}>
              {saving ? 'Saving…' : 'Save media details'}
            </Button>
          </div>
        </div>
      )}

      {tab === 'analytics' && <AnalyticsPanel locked={locked} />}
    </div>
  )
}
