import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FaMapMarkerAlt, FaPhone, FaGlobe, FaStar, FaSearch } from 'react-icons/fa'
import { fetchApi, apiEnabled } from '../lib/api'
import { centerMatchesService, extractStateFromLocation, normalizeText, specialtyMatchesAnyService } from '../lib/rehabServices'
import RehabSearch from '../components/RehabSearch'
import './RehabCenters.css'

const STATIC_CENTERS = [
  {
    id: 1,
    name: 'Hazelden Betty Ford Foundation',
    location: 'Rancho Mirage, California',
    phone: '1-866-831-5700',
    website: 'https://www.hazeldenbettyford.org',
    image: '/images/rehab/hazelden-betty-ford.webp',
    specialties: ['Inpatient Residential', 'Medical Detox', 'Dual Diagnosis', 'Telehealth'],
    description: 'The Betty Ford Center is a world-renowned inpatient addiction treatment facility co-founded in 1982 by former First Lady Betty Ford.',
    rating: 5,
    claimed: true,
  },
  {
    id: 2,
    name: 'Caron Treatment Centers',
    location: 'Wernersville, Pennsylvania',
    phone: '1-800-854-6023',
    website: 'https://www.caron.org',
    image: '/images/rehab/caron-treatment-centers.webp',
    specialties: ['Medical Detox', 'Inpatient', 'Dual Diagnosis', 'Executive Program'],
    description: 'Caron is a nationally recognized nonprofit provider of comprehensive addiction and behavioral health treatment.',
    rating: 5,
    claimed: true,
  },
  {
    id: 3,
    name: 'Sierra Tucson',
    location: 'Tucson, Arizona',
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
    phone: '617-855-2000',
    website: 'https://www.mcleanhospital.org',
    image: '/images/rehab/mclean-hospital.webp',
    specialties: ['Harvard-Affiliated', 'Medical Detox', 'Inpatient & IOP', 'Co-occurring Disorders'],
    description: 'The largest psychiatric teaching hospital of Harvard Medical School.',
    rating: 5,
  },
]

function ClaimModal({ center, onClose }) {
  const [submitted, setSubmitted] = useState(false)
  const [ticket, setTicket] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    full_name: '',
    job_title: '',
    work_email: '',
    phone: '',
    affiliation_text: '',
    facility_role: 'other',
  })

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    if (apiEnabled()) {
      try {
        const res = await fetchApi('/api/rehab/claims', {
          method: 'POST',
          body: JSON.stringify({ rehab_center_id: center.id, ...form }),
        })
        setTicket(res.ticket_number)
        setSubmitted(true)
      } catch (err) {
        setError(err.message)
      }
    } else {
      setSubmitted(true)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        {submitted ? (
          <div className="modal-success">
            <div className="modal-success-icon">✓</div>
            <h3>Request Received!</h3>
            {ticket ? (
              <>
                <p>Your ticket number: <strong>{ticket}</strong></p>
                <p><Link to={`/claim-status/${ticket}`}>Track your claim status →</Link></p>
              </>
            ) : (
              <p>Thank you for claiming <strong>{center.name}</strong>. Our team will review your request.</p>
            )}
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <div className="modal-header">
              <span className="section-label">Claim This Listing</span>
              <h3>{center.name}</h3>
              <p>Fill out the form below and our team will verify your ownership.</p>
            </div>
            {error && <p style={{ color: '#8c1126', marginBottom: '0.5rem' }}>{error}</p>}
            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <label>Your Name<input type="text" required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></label>
                <label>Job Title<input type="text" required value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} /></label>
              </div>
              <label>Work Email<input type="email" required value={form.work_email} onChange={e => setForm(f => ({ ...f, work_email: e.target.value }))} /></label>
              <label>Phone Number<input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></label>
              <label>Your role
                <select value={form.facility_role} onChange={e => setForm(f => ({ ...f, facility_role: e.target.value }))}>
                  <option value="owner">Owner</option>
                  <option value="director">Director</option>
                  <option value="marketing">Marketing</option>
                  <option value="staff">Staff</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                How are you affiliated with this center?
                <textarea rows="3" required value={form.affiliation_text} onChange={e => setForm(f => ({ ...f, affiliation_text: e.target.value }))} />
              </label>
              <button type="submit" className="btn">Submit Claim Request</button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

function filterCenters(centers, { query, state, service }) {
  const q = normalizeText(query)
  return centers.filter(center => {
    if (state) {
      const centerState = extractStateFromLocation(center.location)
      if (!centerState || normalizeText(centerState) !== normalizeText(state)) return false
    }
    if (service && !centerMatchesService(center.specialties, service)) return false
    if (q) {
      const blob = normalizeText([
        center.name,
        center.location,
        center.description,
        ...(center.specialties || []),
      ].join(' '))
      if (!blob.includes(q)) return false
    }
    return true
  })
}

export default function RehabCenters() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [claimCenter, setClaimCenter] = useState(null)
  const [centers, setCenters] = useState(STATIC_CENTERS)
  const [loading, setLoading] = useState(apiEnabled())
  const [query, setQuery] = useState(() => searchParams.get('q') || '')
  const [stateFilter, setStateFilter] = useState(() => searchParams.get('state') || '')
  const [serviceFilter, setServiceFilter] = useState(() => searchParams.get('service') || '')
  const firstResultRef = useRef(null)

  useEffect(() => {
    if (!apiEnabled()) return
    fetchApi('/api/rehab-centers')
      .then(data => {
        if (data?.length) setCenters(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (stateFilter) params.set('state', stateFilter)
    if (serviceFilter) params.set('service', serviceFilter)
    setSearchParams(params, { replace: true })
  }, [query, stateFilter, serviceFilter, setSearchParams])

  const hasActiveFilters = Boolean(query || stateFilter || serviceFilter)
  const filteredCenters = useMemo(
    () => filterCenters(centers, { query, state: stateFilter, service: serviceFilter }),
    [centers, query, stateFilter, serviceFilter],
  )

  useEffect(() => {
    if (loading || !stateFilter || filteredCenters.length === 0) return
    firstResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [loading, stateFilter, filteredCenters.length])

  function clearFilters() {
    setQuery('')
    setStateFilter('')
    setServiceFilter('')
  }

  return (
    <main className="rehab-page">
      <section className="rehab-hero">
        <div className="rehab-hero-overlay" />
        <div className="container rehab-hero-content">
          <span className="section-label" style={{ color: '#98b8c4' }}>Find Help Near You</span>
          <h1>Rehab directory</h1>
          <p>
            Every facility below is either verified by our team or awaiting claim by its owner.
            Start with your state, or jump straight to a type of care
          </p>
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
              <>Are you a treatment provider? <strong>Claim your listing</strong> to update your information.</>
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
          {!loading && filteredCenters.map((center, index) => (
            <article className="rehab-card" key={center.id} ref={index === 0 ? firstResultRef : null}>
              <div className="rehab-card-img-wrap">
                {center.image && <img src={center.image} alt={center.name} loading="lazy" />}
              </div>
              <div className="rehab-card-body">
                <div className="rehab-card-top">
                  <div>
                    <div className="rehab-name-row">
                      <h2>{center.name}</h2>
                      {center.claimed && <span className="rehab-claimed-badge">✓ Claimed</span>}
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
                      <a href={`tel:${center.phone.replace(/\D/g, '')}`} className="rehab-contact"><FaPhone aria-hidden="true" /> {center.phone}</a>
                      {center.website && (
                        <a href={center.website} target="_blank" rel="noopener noreferrer" className="rehab-contact"><FaGlobe aria-hidden="true" /> Visit Website</a>
                      )}
                      <a href={`tel:${center.phone.replace(/\D/g, '')}`} className="btn rehab-call-btn">Call Now</a>
                    </>
                  ) : (
                    <p className="rehab-unclaimed-notice"><FaPhone aria-hidden="true" /> Contact info available after claiming this listing.</p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rehab-cta-section">
        <div className="container rehab-cta-inner">
          <div>
            <h2>Is Your Facility Missing?</h2>
            <p>We list accredited, high-quality treatment centers committed to ethical care.</p>
          </div>
          <div className="rehab-cta-btns">
            <button className="btn btn-white" onClick={() => setClaimCenter(centers[0])}>Submit Your Center</button>
            <a href="mailto:help@strugglingwithaddiction.com" className="btn btn-white-outline">Contact Us</a>
          </div>
        </div>
      </section>

      {claimCenter && <ClaimModal center={claimCenter} onClose={() => setClaimCenter(null)} />}
    </main>
  )
}
