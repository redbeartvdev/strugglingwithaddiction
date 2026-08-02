import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FaMapMarkerAlt, FaPhone, FaEnvelope, FaStar, FaSearch } from 'react-icons/fa'
import { MdVerified } from 'react-icons/md'
import { fetchApi, apiEnabled, getApiBase } from '../lib/api'
import { centerMatchesService, extractStateFromLocation, normalizeText, specialtyMatchesAnyService, REHAB_SERVICE_TYPES, REHAB_INSURANCE_TYPES } from '../lib/rehabServices'
import { rehabLandingPath } from '../lib/rehabLanding'
import { US_STATES } from '../lib/usStates'
import RehabSearch from '../components/RehabSearch'
import InsuranceAcceptedSection from '../components/InsuranceAcceptedSection'
import './RehabCenters.css'

export const STATIC_CENTERS = [
  {
    id: 1,
    name: 'Hazelden Betty Ford Foundation',
    location: 'Rancho Mirage, California',
    city: 'Rancho Mirage',
    state: 'California',
    address_line: '39000 Bob Hope Drive',
    zip: '92270',
    phone: '1-866-831-5700',
    contact_email: 'hazelden@example.com',
    website: 'https://www.hazeldenbettyford.org',
    image: '/images/rehab/hazelden-betty-ford.webp',
    gallery_urls: ['/images/rehab/hazelden-betty-ford.webp'],
    specialties: ['Inpatient Residential', 'Medical Detox', 'Dual Diagnosis', 'Telehealth'],
    levels_of_care: ['Detox', 'Residential', 'PHP', 'IOP', 'Outpatient'],
    amenities: ['Private Rooms Available', 'Family Program', 'Yoga & Meditation'],
    insurances: ['Aetna', 'Blue Cross Blue Shield', 'Cigna', 'UnitedHealthcare', 'Anthem', 'Optum'],
    insurance_details: [
      { name: 'Aetna', slug: 'aetna', logo_url: '/images/insurance/aetna.png' },
      { name: 'Blue Cross Blue Shield', slug: 'blue-cross-blue-shield', logo_url: '/images/insurance/blue-cross-blue-shield.png' },
      { name: 'Cigna', slug: 'cigna', logo_url: '/images/insurance/cigna.png' },
      { name: 'UnitedHealthcare', slug: 'unitedhealthcare', logo_url: '/images/insurance/unitedhealthcare.png' },
      { name: 'Anthem', slug: 'anthem', logo_url: '/images/insurance/anthem.png' },
      { name: 'Optum', slug: 'optum', logo_url: '/images/insurance/optum.png' },
    ],
    accreditations: ['Joint Commission', 'CARF'],
    testimonials: [
      { author: 'Former patient', quote: 'The staff treated me with dignity and gave me a clear path forward.', rating: 5 },
      { author: 'Family member', quote: 'We finally felt hope. Communication was clear from day one.', rating: 5 },
      { author: 'Alumni', quote: 'Compassionate care that helped our family rebuild.', rating: 5 },
      { author: 'Parent', quote: 'Aftercare support made the transition home feel possible.', rating: 4 },
    ],
    google_maps_url: 'https://maps.google.com/?q=Hazelden+Betty+Ford+Rancho+Mirage',
    google_reviews_url: 'https://www.google.com/maps/search/?api=1&query=Hazelden+Betty+Ford+Rancho+Mirage',
    description: 'The Betty Ford Center is a world-renowned inpatient addiction treatment facility co-founded in 1982 by former First Lady Betty Ford.',
    rating: 5,
    verified_badge: true,
    featured: true,
    claimed: true,
  },
  {
    id: 2,
    name: 'Caron Treatment Centers',
    location: 'Wernersville, Pennsylvania',
    city: 'Wernersville',
    state: 'Pennsylvania',
    address_line: '243 N Galen Hall Road',
    zip: '19565',
    phone: '1-800-854-6023',
    contact_email: 'caron@example.com',
    website: 'https://www.caron.org',
    image: '/images/rehab/caron-treatment-centers.webp',
    gallery_urls: ['/images/rehab/caron-treatment-centers.webp'],
    specialties: ['Medical Detox', 'Inpatient', 'Dual Diagnosis', 'Executive Program'],
    levels_of_care: ['Detox', 'Residential', 'Extended Care', 'Outpatient'],
    amenities: ['Executive Track', 'Family Support', 'Fitness Program'],
    insurances: ['Aetna', 'Cigna', 'UnitedHealthcare', 'Tricare'],
    insurance_details: [
      { name: 'Aetna', slug: 'aetna', logo_url: '/images/insurance/aetna.png' },
      { name: 'Cigna', slug: 'cigna', logo_url: '/images/insurance/cigna.png' },
      { name: 'UnitedHealthcare', slug: 'unitedhealthcare', logo_url: '/images/insurance/unitedhealthcare.png' },
      { name: 'Tricare', slug: 'tricare', logo_url: '/images/insurance/tricare.png' },
    ],
    accreditations: ['Joint Commission', 'LegitScript'],
    testimonials: [
      { author: 'Alumni', quote: 'Caron gave me structure, community, and tools I still use every day.', rating: 5 },
      { author: 'Parent', quote: 'The clinical team was honest, skilled, and deeply caring.', rating: 5 },
      { author: 'Alumni', quote: 'A structured program with real medical depth.', rating: 5 },
      { author: 'Spouse', quote: 'The family workshops helped us repair what addiction broke.', rating: 4 },
    ],
    google_maps_url: 'https://maps.google.com/?q=Caron+Treatment+Centers+Wernersville',
    google_reviews_url: 'https://www.google.com/maps/search/?api=1&query=Caron+Treatment+Centers+Wernersville',
    description: 'Caron is a nationally recognized nonprofit provider of comprehensive addiction and behavioral health treatment.',
    rating: 5,
    verified_badge: true,
    claimed: true,
  },
  {
    id: 3,
    name: 'Sierra Tucson',
    location: 'Tucson, Arizona',
    city: 'Tucson',
    state: 'Arizona',
    phone: '(844) 276-1469',
    website: 'https://www.sierratucson.com',
    image: '/images/rehab/sierra-tucson.webp',
    specialties: ['Residential', 'Trauma & PTSD', 'Eating Disorders', 'Equine Therapy'],
    description: 'Ranked #1 in Newsweek\'s Best Addiction Treatment Centers in Arizona for 2025.',
    rating: 5,
  },
  {
    id: 4,
    name: 'The Ranch Tennessee',
    location: 'Nunnelly, Tennessee',
    city: 'Nunnelly',
    state: 'Tennessee',
    phone: '(931) 416-1559',
    website: 'https://www.theranch.com',
    image: '/images/rehab/the-ranch-tennessee.webp',
    specialties: ['Substance Use', 'Mental Health', 'Equine Therapy', 'Extended Care'],
    description: 'Located on peaceful grounds along the Piney River, The Ranch combines traditional and alternative therapies.',
    rating: 4,
  },
  {
    id: 5,
    name: 'McLean Hospital',
    location: 'Belmont, Massachusetts',
    city: 'Belmont',
    state: 'Massachusetts',
    phone: '617-855-2000',
    website: 'https://www.mcleanhospital.org',
    image: '/images/rehab/mclean-hospital.webp',
    specialties: ['Harvard-Affiliated', 'Medical Detox', 'Inpatient & IOP', 'Co-occurring Disorders'],
    description: 'The largest psychiatric teaching hospital of Harvard Medical School.',
    rating: 5,
  },
]

// NOTE: Backend endpoints used:
// POST /api/rehab/claims/start - start claim with account info
// POST /api/rehab/claims/{ticket}/cert - upload certification file
// GET /api/rehab/claims/{ticket} - check claim status
// POST /api/billing/checkout-claim - checkout when certified (body: { ticket_number, interval })
// POST /api/center-submissions - submit a missing facility for admin review

const EMPTY_SUBMIT_FORM = {
  full_name: '',
  center_name: '',
  email: '',
  phone: '',
  address_line: '',
  city: '',
  state: '',
  zip: '',
  description: '',
}

function MultiSelectDropdown({
  label,
  hint,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
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
    onChange(
      value.includes(optValue)
        ? value.filter(v => v !== optValue)
        : [...value, optValue],
    )
  }

  function remove(optValue) {
    onChange(value.filter(v => v !== optValue))
  }

  const summary = value.length === 0
    ? placeholder
    : value.length === 1
      ? value[0]
      : `${value.length} selected`

  return (
    <div className="modal-multiselect" ref={rootRef}>
      <div className="modal-multiselect-label">
        {label}
        {hint && <span>{hint}</span>}
      </div>
      <button
        type="button"
        className={`modal-multiselect-trigger${open ? ' is-open' : ''}${value.length ? ' has-value' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <span>{summary}</span>
        <span className="modal-multiselect-caret" aria-hidden="true" />
      </button>

      {value.length > 0 && (
        <div className="modal-multiselect-chips">
          {value.map(item => (
            <button
              key={item}
              type="button"
              className="modal-multiselect-chip"
              onClick={() => remove(item)}
              aria-label={`Remove ${item}`}
            >
              {item}
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="modal-multiselect-panel" role="listbox" aria-multiselectable="true">
          <input
            type="search"
            className="modal-multiselect-search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            autoFocus
            aria-label={searchPlaceholder}
          />
          <div className="modal-multiselect-options">
            {filtered.length === 0 ? (
              <p className="modal-multiselect-empty">No matches</p>
            ) : (
              filtered.map(opt => {
                const selected = value.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`modal-multiselect-option${selected ? ' is-on' : ''}`}
                    onClick={() => toggle(opt.value)}
                  >
                    <span className="modal-multiselect-check" aria-hidden="true">{selected ? '✓' : ''}</span>
                    <span>{opt.label}</span>
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

function SubmitCenterModal({ onClose }) {
  const [form, setForm] = useState(EMPTY_SUBMIT_FORM)
  const [services, setServices] = useState([])
  const [insurances, setInsurances] = useState([])
  const [catalog, setCatalog] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const serviceOptions = useMemo(
    () => REHAB_SERVICE_TYPES.map(s => ({ value: s.label, label: s.label })),
    [],
  )
  const insuranceOptions = useMemo(
    () => catalog.map(item => ({ value: item.name, label: item.name })),
    [catalog],
  )

  useEffect(() => {
    if (!apiEnabled()) {
      setCatalog(REHAB_INSURANCE_TYPES.map((item, i) => ({ id: item.id || i, name: item.label })))
      return
    }
    fetchApi('/api/insurances')
      .then(data => {
        if (Array.isArray(data) && data.length) {
          setCatalog(data)
          return
        }
        setCatalog(REHAB_INSURANCE_TYPES.map((item, i) => ({ id: item.id || i, name: item.label })))
      })
      .catch(() => {
        setCatalog(REHAB_INSURANCE_TYPES.map((item, i) => ({ id: item.id || i, name: item.label })))
      })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!services.length) {
      setError('Select at least one type of service.')
      return
    }
    if (!insurances.length) {
      setError('Select at least one insurance type.')
      return
    }
    setBusy(true)
    try {
      if (apiEnabled()) {
        await fetchApi('/api/center-submissions', {
          method: 'POST',
          body: JSON.stringify({
            ...form,
            services,
            insurances,
          }),
        })
      }
      setDone(true)
    } catch (err) {
      setError(err.message || 'Submission failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>

        {done ? (
          <div className="modal-success">
            <div className="modal-success-icon">✓</div>
            <h3>Submission received</h3>
            <p>Thanks — our team will review {form.center_name || 'your facility'} and follow up by email.</p>
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <div className="modal-header">
              <span className="section-label">Submit your center</span>
              <h3>Add your facility to the directory</h3>
              <p>Tell us about your treatment center. Our team reviews every submission before publishing.</p>
            </div>
            {error && <p style={{ color: '#8c1126', marginBottom: '0.75rem' }}>{error}</p>}
            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="modal-form-grid">
                <label>Full name<input type="text" required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></label>
                <label>Rehab center name<input type="text" required value={form.center_name} onChange={e => setForm(f => ({ ...f, center_name: e.target.value }))} /></label>
                <label>Email<input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></label>
                <label>Contact number<input type="tel" required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></label>
                <label className="modal-span-2">Street address<input type="text" required value={form.address_line} onChange={e => setForm(f => ({ ...f, address_line: e.target.value }))} placeholder="123 Main St, Suite 100" /></label>
                <label>City<input type="text" required value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></label>
                <label>
                  State
                  <select required value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}>
                    <option value="">Select state</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
                <label>ZIP<input type="text" value={form.zip} onChange={e => setForm(f => ({ ...f, zip: e.target.value }))} /></label>
              </div>

              <MultiSelectDropdown
                label="Types of services"
                hint="select all that apply"
                options={serviceOptions}
                value={services}
                onChange={setServices}
                placeholder="Select services…"
                searchPlaceholder="Search services…"
              />

              <MultiSelectDropdown
                label="Insurance accepted"
                hint="select multiple"
                options={insuranceOptions}
                value={insurances}
                onChange={setInsurances}
                placeholder="Select insurance…"
                searchPlaceholder="Search insurance…"
              />

              <label>
                Description
                <textarea
                  required
                  minLength={20}
                  rows={4}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Tell families what makes your program unique…"
                />
              </label>

              <button type="submit" className="btn" disabled={busy}>
                {busy ? 'Submitting…' : 'Submit center'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

function ClaimModal({ center, onClose }) {
  const [step, setStep] = useState(1) // 1=account, 2=confirm, 3=cert, 4=status
  const [ticket, setTicket] = useState('')
  const [claimStatus, setClaimStatus] = useState('')
  const [centerName, setCenterName] = useState(center?.name || '')
  const [checkoutReady, setCheckoutReady] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    work_email: '',
    password: '',
    phone: '',
    job_title: '',
    facility_role: 'other',
    affiliation_text: '',
  })

  const handleAccountSubmit = async e => {
    e.preventDefault()
    setError('')
    setCenterName(center.name)
    setStep(2)
  }

  const handleConfirmFacility = async () => {
    setError('')
    if (apiEnabled()) {
      try {
        const res = await fetchApi('/api/rehab/claims/start', {
          method: 'POST',
          body: JSON.stringify({
            rehab_center_id: center.id,
            full_name: form.full_name,
            work_email: form.work_email,
            password: form.password,
            phone: form.phone,
            job_title: form.job_title,
            facility_role: form.facility_role,
            affiliation_text: form.affiliation_text,
          }),
        })
        setTicket(res.ticket_number)
        setClaimStatus(res.status)
        setCenterName(res.center_name || center.name)
        setCheckoutReady(res.checkout_ready || false)
        setStep(3)
      } catch (err) {
        setError(err.message)
      }
    } else {
      setTicket('DEMO-TICKET')
      setCenterName(center.name)
      setStep(3)
    }
  }

  const handleCertUpload = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setUploading(true)
    if (apiEnabled()) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        const base = getApiBase()
        const r = await fetch(`${base}/api/rehab/claims/${encodeURIComponent(ticket)}/cert`, {
          method: 'POST',
          body: formData,
        })
        const text = await r.text()
        let res = {}
        try {
          res = text ? JSON.parse(text) : {}
        } catch {
          res = {}
        }
        if (!r.ok) {
          const detail = res.detail
          throw new Error(typeof detail === 'string' ? detail : 'Upload failed')
        }
        setClaimStatus(res.status || 'under_review')
        setCheckoutReady(res.checkout_ready || false)
        setStep(4)
      } catch (err) {
        setError(err.message || 'Upload failed')
      }
    } else {
      setTimeout(() => {
        setClaimStatus('under_review')
        setCheckoutReady(false)
        setStep(4)
      }, 800)
    }
    setUploading(false)
  }

  const goToCheckout = async interval => {
    if (apiEnabled()) {
      try {
        const res = await fetchApi('/api/billing/checkout-claim', {
          method: 'POST',
          body: JSON.stringify({ ticket_number: ticket, interval }),
        })
        window.location.href = res.checkout_url
      } catch (err) {
        setError(err.message)
      }
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>

        {step === 1 && (
          <>
            <div className="modal-header">
              <span className="section-label">Step 1 of 3</span>
              <h3>Create Your Account</h3>
              <p>Set up your credentials to manage <strong>{center.name}</strong>.</p>
            </div>
            {error && <p style={{ color: '#8c1126', marginBottom: '0.5rem' }}>{error}</p>}
            <form className="modal-form" onSubmit={handleAccountSubmit}>
              <label>Full Name<input type="text" required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></label>
              <label>Work Email<input type="email" required value={form.work_email} onChange={e => setForm(f => ({ ...f, work_email: e.target.value }))} /></label>
              <label>Password<input type="password" required minLength="8" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></label>
              <label>Phone<input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></label>
              <button type="submit" className="btn">Continue</button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <div className="modal-header">
              <span className="section-label">Step 2 of 3</span>
              <h3>Confirm Your Facility</h3>
              <p>Confirm you are claiming <strong>{centerName || center.name}</strong>.</p>
            </div>
            <div style={{ background: '#f9fafb', padding: '1.25rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #e5e7eb' }}>
              <h4 style={{ fontSize: '1.1rem', color: '#1a1a2e', margin: '0 0 0.25rem' }}>{centerName || center.name}</h4>
              <p style={{ fontSize: '0.88rem', color: '#6b7280', margin: 0 }}>{center.location}</p>
            </div>
            <div className="modal-form">
              {error && <p style={{ color: '#8c1126', marginBottom: '0.5rem' }}>{error}</p>}
              <button type="button" className="btn" onClick={handleConfirmFacility}>Yes, This Is Correct</button>
              <button type="button" className="btn" style={{ background: '#f3f4f6', color: '#374151' }} onClick={() => setStep(1)}>Back</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="modal-header">
              <span className="section-label">Step 3 of 3</span>
              <h3>Upload Certification</h3>
              <p>Provide proof you work at <strong>{centerName || center.name}</strong> (employment verification, business card, license, etc.)</p>
            </div>
            {error && <p style={{ color: '#8c1126', marginBottom: '0.5rem' }}>{error}</p>}
            <div className="modal-form">
              <label style={{ cursor: 'pointer', border: '2px dashed #98b8c4', borderRadius: '8px', padding: '2rem', textAlign: 'center', background: '#fafaf8', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f0f4f5'} onMouseOut={e => e.currentTarget.style.background = '#fafaf8'}>
                {uploading ? 'Uploading…' : 'Choose File to Upload'}
                <input type="file" accept="image/*,.pdf" onChange={handleCertUpload} style={{ display: 'none' }} disabled={uploading} />
              </label>
              <button type="button" className="btn" style={{ background: '#e5e7eb', color: '#6b7280' }} onClick={() => setStep(2)}>Back</button>
            </div>
          </>
        )}

        {step === 4 && (
          <div className="modal-success">
            <div className="modal-success-icon">✓</div>
            {checkoutReady && claimStatus === 'certified' ? (
              <>
                <h3>Verified!</h3>
                <p style={{ marginBottom: '0.75rem' }}>Your claim for <strong>{centerName || center.name}</strong> has been verified.</p>
                <p style={{ marginBottom: '1rem' }}>Ticket: <strong>{ticket}</strong></p>
                <div style={{ background: '#f0f9ff', border: '1px solid #98b8c4', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem', textAlign: 'left' }}>
                  <h4 style={{ fontSize: '1rem', margin: '0 0 0.5rem', color: '#1a1a2e' }}>Subscribe to claim {centerName || center.name}</h4>
                  <p style={{ fontSize: '0.9rem', color: '#4b5563', marginBottom: '1rem' }}>Subscribe now to publish your listing and start receiving leads.</p>
                  <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
                    <button type="button" className="btn" onClick={() => goToCheckout('year')} style={{ fontSize: '0.9rem' }}>
                      <strong>$99/year</strong> <span style={{ fontSize: '0.8rem', marginLeft: '0.5rem', opacity: 0.85 }}>(Save 2 months!)</span>
                    </button>
                    <button type="button" className="btn" onClick={() => goToCheckout('month')} style={{ background: 'white', color: '#1a1a2e', border: '2px solid #e5e7eb', fontSize: '0.9rem' }}>
                      $9.99/month
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h3>Proof Received — Pending Verification</h3>
                <p style={{ marginBottom: '0.75rem' }}>
                  Your claim for <strong>{centerName || center.name}</strong> is already submitted and waiting for an admin to verify your proof.
                </p>
                <p style={{ marginBottom: '0.75rem', color: '#4b5563', fontSize: '0.95rem' }}>
                  Please wait until an admin verifies your certification. We sent a confirmation email to <strong>{form.work_email}</strong>, and you will get another email when verification is complete.
                </p>
                <p style={{ marginBottom: '1rem' }}>Ticket: <strong>{ticket}</strong></p>
                <p style={{ marginBottom: '1.5rem' }}><Link to={`/claim-status/${ticket}`}>Track your claim status →</Link></p>
              </>
            )}

            <button className="btn" style={{ background: '#e5e7eb', color: '#374151' }} onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  )
}

function filterCenters(centers, { query, state, service, insurance }) {
  const q = normalizeText(query)
  const insuranceNeedle = normalizeText(insurance)
  return centers.filter(center => {
    if (state) {
      const centerState = extractStateFromLocation(center.location)
      if (!centerState || normalizeText(centerState) !== normalizeText(state)) return false
    }
    if (service && !centerMatchesService(center.specialties, service)) return false
    if (insuranceNeedle) {
      const names = [
        ...(center.insurances || []),
        ...((center.insurance_details || []).map(d => d.name)),
      ]
      if (!names.some(name => normalizeText(name).includes(insuranceNeedle) || insuranceNeedle.includes(normalizeText(name)))) {
        return false
      }
    }
    if (q) {
      const blob = normalizeText([
        center.name,
        center.location,
        center.description,
        ...(center.specialties || []),
        ...(center.insurances || []),
      ].join(' '))
      if (!blob.includes(q)) return false
    }
    return true
  })
}

// NOTE: Backend endpoint used for leads:
// POST /api/rehab-centers/{slug}/leads body: { full_name, email, phone?, message, source_url? }

export default function RehabCenters() {
  const [searchParams] = useSearchParams()
  const [claimCenter, setClaimCenter] = useState(null)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [centers, setCenters] = useState(STATIC_CENTERS)
  const [loading, setLoading] = useState(apiEnabled())
  const [query, setQuery] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [serviceFilter, setServiceFilter] = useState('')
  const [insuranceFilter, setInsuranceFilter] = useState(() => searchParams.get('insurance') || '')
  const [insuranceOptions, setInsuranceOptions] = useState([])

  useEffect(() => {
    const fromUrl = searchParams.get('insurance') || ''
    setInsuranceFilter(fromUrl)
  }, [searchParams])

  useEffect(() => {
    if (!apiEnabled()) return
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)
    fetchApi('/api/rehab-centers', { signal: controller.signal })
      .then(data => {
        if (data?.length) setCenters(data)
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(timeout)
        setLoading(false)
      })
    fetchApi('/api/insurances').then(data => {
      if (Array.isArray(data)) setInsuranceOptions(data)
    }).catch(() => {})
    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [])

  const hasActiveFilters = Boolean(query || stateFilter || serviceFilter || insuranceFilter)
  const filteredCenters = useMemo(
    () => filterCenters(centers, {
      query,
      state: stateFilter,
      service: serviceFilter,
      insurance: insuranceFilter,
    }),
    [centers, query, stateFilter, serviceFilter, insuranceFilter],
  )

  function clearFilters() {
    setQuery('')
    setStateFilter('')
    setServiceFilter('')
    setInsuranceFilter('')
  }

  return (
    <main className="rehab-page">
      <section className="rehab-hero">
        <div className="rehab-hero-overlay" />
        <div className="container rehab-hero-content">
          <span className="section-label" style={{ color: '#5FBDF6' }}>Find Help Near You</span>
          <h1>
            <span className="rehab-hero-line">Trusted Rehab Centers</span>
            <span className="rehab-hero-line">Across the USA</span>
          </h1>
          <p>Accredited treatment facilities with proven track records of helping people reclaim their lives from addiction.</p>
        </div>
      </section>

      <div className="container">
        <RehabSearch
          query={query}
          onQueryChange={setQuery}
          state={stateFilter}
          onStateChange={setStateFilter}
          service={serviceFilter}
          onServiceChange={setServiceFilter}
          insurance={insuranceFilter}
          onInsuranceChange={setInsuranceFilter}
          insuranceOptions={insuranceOptions}
          resultCount={filteredCenters.length}
          totalCount={centers.length}
          onClear={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />
      </div>

      <div className="rehab-intro-bar">
        <div className="container rehab-intro-inner">
          <p>
            {loading ? (
              <>Loading featured centers…</>
            ) : hasActiveFilters ? (
              <>Refine your search above or browse all <strong>{centers.length} centers</strong>.</>
            ) : (
              <>Are you a treatment provider? <Link to="/provider">Log in to the provider platform</Link> or <strong>claim your listing</strong> below.</>
            )}
          </p>
        </div>
      </div>

      <section className="rehab-list-section">
        <div className="container rehab-list">
          {loading && <p style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>Loading centers…</p>}
          {!loading && filteredCenters.length === 0 && (
            <div className="rehab-empty-state">
              <div className="rehab-empty-state-icon" aria-hidden="true"><FaSearch /></div>
              <h3>No centers match your search</h3>
              <p>Try adjusting your filters or search term — we&apos;re adding new accredited facilities regularly.</p>
              <button type="button" className="btn" onClick={clearFilters}>Clear all filters</button>
            </div>
          )}
          {!loading && filteredCenters.map(center => {
            const landingPath = center.claimed ? rehabLandingPath(center) : null
            return (
            <article className="rehab-card" key={center.id}>
              <div className="rehab-card-img-wrap">
                {center.image && (landingPath
                  ? <Link to={landingPath} aria-label={`View ${center.name} landing page`}><img src={center.image} alt={center.name} loading="lazy" /></Link>
                  : <img src={center.image} alt={center.name} loading="lazy" />
                )}
              </div>
              <div className="rehab-card-body">
                <div className="rehab-card-top">
                  <div>
                    <div className="rehab-name-row">
                      <h2>{landingPath ? <Link to={landingPath}>{center.name}</Link> : center.name}</h2>
                      {center.featured && <span className="rehab-featured-badge">Featured</span>}
                      {center.verified_badge && (
                        <span className="rehab-verified-badge">
                          <MdVerified aria-hidden="true" />
                          Verified
                        </span>
                      )}
                    </div>
                    <div className="rehab-card-meta">
                      <span className="rehab-location"><FaMapMarkerAlt aria-hidden="true" /> {center.location}</span>
                      <span className="rehab-stars" aria-label={`${center.rating} out of 5 stars`}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <FaStar key={i} style={{ color: i < center.rating ? '#8c1126' : '#e5e7eb' }} />
                        ))}
                      </span>
                    </div>
                  </div>
                  {!center.claimed && (
                    <button className="btn rehab-claim-btn" onClick={() => setClaimCenter(center)}>Claim This Center</button>
                  )}
                </div>
                <div className="rehab-specialties">
                  {(center.specialties || []).map(s => (
                    <span
                      className={`rehab-tag${serviceFilter && specialtyMatchesAnyService(s, [serviceFilter]) ? ' rehab-tag--match' : ''}`}
                      key={s}
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <p className="rehab-description">{center.description}</p>
                <div className="rehab-card-footer">
                  {center.claimed && center.phone ? (
                    <>
                      <div className="rehab-card-contacts">
                        <a href={`tel:${center.phone.replace(/\D/g, '')}`} className="rehab-contact"><FaPhone aria-hidden="true" /> {center.phone}</a>
                        {center.contact_email && (
                          <a href={`mailto:${center.contact_email}`} className="rehab-contact"><FaEnvelope aria-hidden="true" /> {center.contact_email}</a>
                        )}
                      </div>
                      <div className="rehab-card-actions">
                        {landingPath && <Link to={landingPath} className="btn rehab-action-btn">View</Link>}
                      </div>
                    </>
                  ) : (
                    <p className="rehab-unclaimed-notice"><FaPhone aria-hidden="true" /> Contact info available after claiming this listing.</p>
                  )}
                </div>
              </div>
            </article>
            )
          })}
        </div>
      </section>

      <InsuranceAcceptedSection />

      <section className="rehab-cta-section">
        <div className="container rehab-cta-inner">
          <div>
            <h2>Is Your Facility Missing?</h2>
            <p>We list accredited, high-quality treatment centers committed to ethical care.</p>
          </div>
          <div className="rehab-cta-btns">
            <button type="button" className="btn btn-white" onClick={() => setSubmitOpen(true)}>Submit Your Center</button>
            <Link to="/provider" className="btn btn-white">Provider Login</Link>
            <a href="tel:18005551234" className="btn btn-white">Call Our Team</a>
          </div>
        </div>
      </section>

      {submitOpen && <SubmitCenterModal onClose={() => setSubmitOpen(false)} />}
      {claimCenter && <ClaimModal center={claimCenter} onClose={() => setClaimCenter(null)} />}
    </main>
  )
}
