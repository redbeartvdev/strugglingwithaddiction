import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
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
  ['partner', 'Partner page'],
  ['analytics', 'Analytics'],
]

function StatCard({ label, value, hint }) {
  return (
    <div className="mc-stat">
      <p className="mc-stat-label">{label}</p>
      <p className="mc-stat-value">{value}</p>
      {hint && <p className="mc-stat-hint">{hint}</p>}
    </div>
  )
}

function PartnerLandingForm({ landing, setLanding, locked, saving, onSave }) {
  const publicUrl = landing.slug ? `/partners/${landing.slug}` : null
  return (
    <form className="card card-flat form-stack mc-form" onSubmit={onSave}>
      <div className="mc-insurance-head">
        <div>
          <p className="eyebrow">Partner landing page</p>
          <p className="page-sub" style={{ margin: 0 }}>
            Headline, about, SEO, and publish settings for your public partner page
            {publicUrl ? <> at <a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a></> : null}.
          </p>
        </div>
      </div>

      <label className="field">
        <span className="field-label">Headline</span>
        <input
          disabled={locked}
          value={landing.headline}
          onChange={e => setLanding(l => ({ ...l, headline: e.target.value }))}
        />
      </label>
      <label className="field">
        <span className="field-label">About</span>
        <textarea
          rows={6}
          disabled={locked}
          value={landing.about_html}
          onChange={e => setLanding(l => ({ ...l, about_html: e.target.value }))}
        />
      </label>
      <div className="form-grid-2">
        <label className="field">
          <span className="field-label">Meta title</span>
          <input
            disabled={locked}
            value={landing.meta_title}
            onChange={e => setLanding(l => ({ ...l, meta_title: e.target.value }))}
          />
        </label>
        <label className="field">
          <span className="field-label">Meta description</span>
          <input
            disabled={locked}
            value={landing.meta_description}
            onChange={e => setLanding(l => ({ ...l, meta_description: e.target.value }))}
          />
        </label>
      </div>
      <label className="checkbox-row">
        <input
          type="checkbox"
          disabled={locked}
          checked={landing.is_published}
          onChange={e => setLanding(l => ({ ...l, is_published: e.target.checked }))}
        />
        Published on /partners/{landing.slug || '…'}
      </label>
      <div className="form-actions">
        <Button type="submit" disabled={saving || locked}>
          {saving ? 'Saving…' : 'Save partner page'}
        </Button>
        {publicUrl && landing.is_published && (
          <a className="btn btn-ghost" href={publicUrl} target="_blank" rel="noreferrer">
            View partner page
          </a>
        )}
      </div>
    </form>
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
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const defaultTab = location.pathname.includes('/landing') ? 'partner' : 'overview'
  const initialTab = TABS.some(([id]) => id === searchParams.get('tab')) ? searchParams.get('tab') : defaultTab
  const [tab, setTab] = useState(initialTab)
  const [center, setCenter] = useState(undefined)
  const [form, setForm] = useState(null)
  const [landing, setLanding] = useState(null)
  const [catalog, setCatalog] = useState([])
  const [selectedInsurance, setSelectedInsurance] = useState([])
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingLanding, setSavingLanding] = useState(false)
  const [uploadingGallery, setUploadingGallery] = useState(false)
  const [uploadingHero, setUploadingHero] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const next = searchParams.get('tab')
    if (next && TABS.some(([id]) => id === next) && next !== tab) {
      setTab(next)
    } else if (!next && location.pathname.includes('/landing') && tab !== 'partner') {
      setTab('partner')
    }
  }, [searchParams, tab, location.pathname])

  function selectTab(id) {
    setTab(id)
    setSearchParams(id === 'overview' ? {} : { tab: id }, { replace: true })
  }

  useEffect(() => {
    let cancelled = false
    setLoadError('')
    ;(async () => {
      let centerError = ''
      const [c, landingPage] = await Promise.all([
        api('/api/client/my-center').catch((e) => {
          centerError = e.message || 'Could not load your listing.'
          return null
        }),
        api('/api/client/landing').catch(() => null),
      ])
      if (cancelled) return
      setCenter(c ?? null)
      if (centerError && !c) setLoadError(centerError)
      if (landingPage) {
        setLanding({
          headline: landingPage.headline || '',
          about_html: landingPage.about_html || '',
          is_published: Boolean(landingPage.is_published),
          meta_title: landingPage.meta_title || '',
          meta_description: landingPage.meta_description || '',
          slug: landingPage.slug || '',
          display_name: landingPage.display_name || '',
          hero_image_url: landingPage.hero_image_url || null,
        })
      }
      const ins = await api('/api/insurances').catch(() => [])
      if (cancelled) return
      setCatalog(ins || [])
      if (!c) return
      setForm({
        name: c.name || '',
        description: c.description || '',
        address_line: c.address_line || '',
        city: c.city || '',
        state: c.state || '',
        zip: c.zip || '',
        phone: c.phone || '',
        website: c.website || '',
        contact_email: c.contact_email || '',
        google_maps_url: c.google_maps_url || '',
        google_reviews_url: c.google_reviews_url || '',
        video_url: c.video_url || '',
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
      setSelectedInsurance([...matched, ...custom])
    })()
    return () => { cancelled = true }
  }, [])

  const locked = center?.dashboard_locked

  const insurancePayload = useMemo(() => selectedInsurance.filter(Boolean), [selectedInsurance])

  async function save(e) {
    e?.preventDefault?.()
    if (!form || locked) return
    setSaving(true)
    setErr('')
    setMsg('')
    try {
      const body = {
        ...form,
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

  function toggleInsurance(name) {
    setSelectedInsurance(prev => (
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    ))
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

  async function saveLanding(e) {
    e?.preventDefault?.()
    if (!landing || locked) return
    setSavingLanding(true)
    setErr('')
    setMsg('')
    try {
      const updated = await api('/api/client/landing', {
        method: 'PATCH',
        body: JSON.stringify({
          headline: landing.headline,
          about_html: landing.about_html,
          is_published: landing.is_published,
          meta_title: landing.meta_title || null,
          meta_description: landing.meta_description || null,
        }),
      })
      setLanding(l => ({
        ...l,
        headline: updated.headline || '',
        about_html: updated.about_html || '',
        is_published: Boolean(updated.is_published),
        meta_title: updated.meta_title || '',
        meta_description: updated.meta_description || '',
        slug: updated.slug || l.slug,
        display_name: updated.display_name || l.display_name,
        hero_image_url: updated.hero_image_url || l.hero_image_url,
      }))
      setMsg(updated.is_published ? 'Partner page saved and published.' : 'Partner page saved as draft.')
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setSavingLanding(false)
    }
  }

  if (center === undefined) {
    return (
      <div className="page-stack">
        <header className="page-header">
          <h1 className="page-title">Profile Page Editor.</h1>
        </header>
        <p className="muted">Loading your listing…</p>
      </div>
    )
  }

  if (center === null) {
    return (
      <div className="page-stack">
        <header className="page-header">
          <h1 className="page-title">Profile Page Editor.</h1>
          <p className="page-sub">Edit your public rehab listing and partner page.</p>
        </header>
        {loadError && <p className="form-error">{loadError}</p>}
        {msg && <p className="success">{msg}</p>}
        {err && <p className="form-error">{err}</p>}
        <p className="card card-flat muted">
          No center linked to this account yet. If your listing already shows as claimed or verified on the
          public directory, sign out and back in, or contact{' '}
          <a href="mailto:help@strugglingwithaddiction.com">help@strugglingwithaddiction.com</a>.
          Otherwise claim a listing on the public site, verify certification, then subscribe.
        </p>
        {landing && (
          <PartnerLandingForm
            landing={landing}
            setLanding={setLanding}
            locked={false}
            saving={savingLanding}
            onSave={saveLanding}
          />
        )}
        <p>
          <Link className="btn btn-ghost" to="/client">Back to overview</Link>
        </p>
      </div>
    )
  }

  if (!form) return <p className="muted">Loading…</p>

  const pct = center.completeness?.percent ?? 0
  const onboarding = [
    ['Write your description', Boolean(form.description?.trim())],
    ['Add services and levels of care', Boolean(form.specialties?.trim() && form.levels_of_care?.trim())],
    ['Select accepted insurance', insurancePayload.length > 0],
    ['Add a hero, video, or gallery media', Boolean(center.image_url || form.video_url?.trim() || center.gallery_keys?.length)],
  ]

  return (
    <div className="page-stack mc-page">
      <header className="page-header mc-header">
        <div>
          <h1 className="page-title">Profile Page Editor.</h1>
          <p className="page-sub">Manage listing details, insurance, media gallery, partner page, and analytics in one place.</p>
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
              <button type="button" className="btn btn-ghost" onClick={() => selectTab('media')}>Manage gallery</button>
              <button type="button" className="btn btn-ghost" onClick={() => selectTab('partner')}>Edit partner page</button>
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
              ['contact_email', 'Contact email', 'email'],
              ['google_maps_url', 'Google Map link', 'text'],
              ['google_reviews_url', 'Google reviews link', 'text'],
            ].map(([key, label, type]) => (
              <label key={key} className="field">
                <span className="field-label">{label}</span>
                <input type={type} disabled={locked} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              </label>
            ))}
          </div>

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
            <span className="field-label">Testimonials (one per line)</span>
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
              <p className="page-sub" style={{ margin: 0 }}>Check the plans you accept. Logos appear on your landing page and power the public search filter.</p>
            </div>
            <p className="muted">{insurancePayload.length} selected</p>
          </div>

          <div className="mc-insurance-grid">
            {catalog.map(item => {
              const checked = selectedInsurance.includes(item.name)
              return (
                <label key={item.id} className={`mc-insurance-card${checked ? ' is-on' : ''}`}>
                  <input
                    type="checkbox"
                    disabled={locked}
                    checked={checked}
                    onChange={() => toggleInsurance(item.name)}
                  />
                  <img src={item.logo_url} alt="" />
                  <span>{item.name}</span>
                </label>
              )
            })}
          </div>

          <label className="field" style={{ marginTop: 16 }}>
            <span className="field-label">Other / custom insurance (one per line)</span>
            <textarea
              rows={3}
              disabled={locked}
              value={selectedInsurance.filter(n => !catalog.some(c => c.name === n)).join('\n')}
              onChange={e => {
                const custom = textToList(e.target.value)
                const fromCatalog = selectedInsurance.filter(n => catalog.some(c => c.name === n))
                setSelectedInsurance([...fromCatalog, ...custom])
              }}
              placeholder="e.g. Regional plan name"
            />
          </label>

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
          <label className="field">
            <span className="field-label">Video URL</span>
            <input disabled={locked} value={form.video_url} onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))} />
          </label>

          <div className="field">
            <span className="field-label">Hero / cover image</span>
            {center.image_url && (
              <img src={center.image_url} alt="" className="mc-hero-preview" />
            )}
            <input type="file" accept="image/*" disabled={locked || uploadingHero} onChange={uploadHero} />
            <p className="muted">Shown in the landing hero and directory card.</p>
          </div>

          <div className="field">
            <span className="field-label">Gallery images</span>
            <input type="file" accept="image/*" disabled={locked || uploadingGallery} onChange={uploadGallery} />
            <p className="muted">Upload up to 12 images, 8MB each.</p>
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

      {tab === 'partner' && (
        landing ? (
          <PartnerLandingForm
            landing={landing}
            setLanding={setLanding}
            locked={locked}
            saving={savingLanding}
            onSave={saveLanding}
          />
        ) : (
          <p className="muted">Loading partner page…</p>
        )
      )}

      {tab === 'analytics' && <AnalyticsPanel locked={locked} />}
    </div>
  )
}
