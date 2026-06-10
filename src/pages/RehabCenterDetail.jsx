import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FaMapMarkerAlt, FaPhone, FaGlobe, FaStar, FaArrowLeft } from 'react-icons/fa'
import { fetchApi, apiEnabled } from '../lib/api'
import { HELPLINE_DISPLAY, HELPLINE_TEL } from '../lib/helpline'
import JsonLd from '../components/JsonLd'
import { setPageMeta } from '../hooks/usePageSeo'
import './RehabCenters.css'
import './RehabCenterDetail.css'

const TIER_LABELS = {
  premium: 'Premium Partner',
  standard: 'Featured Listing',
  custom: 'Enterprise Partner',
}

export default function RehabCenterDetail() {
  const { slug } = useParams()
  const [center, setCenter] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!apiEnabled()) {
      setLoading(false)
      setError('Facility details require the API.')
      return
    }
    fetchApi(`/api/rehab-centers/${slug}`)
      .then(data => setCenter(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    if (!center) return undefined
    const title = `${center.name} — Rehab Center`
    const desc = (center.description || '').slice(0, 160)
    document.title = `${title} | Struggling With Addiction`
    setPageMeta('description', desc)
    setPageMeta('og:title', title, 'property')
    setPageMeta('og:description', desc, 'property')
    setPageMeta('og:type', 'website', 'property')
    return () => {
      document.title = 'Struggling With Addiction'
    }
  }, [center])

  const jsonLd = center
    ? {
        '@context': 'https://schema.org',
        '@type': 'MedicalOrganization',
        name: center.name,
        description: center.description,
        address: {
          '@type': 'PostalAddress',
          streetAddress: center.address_line || undefined,
          addressLocality: center.city || undefined,
          addressRegion: center.state || undefined,
          postalCode: center.zip || undefined,
          addressCountry: 'US',
        },
        telephone: center.phone || undefined,
        url: center.website || undefined,
        aggregateRating: center.rating
          ? {
              '@type': 'AggregateRating',
              ratingValue: center.rating,
              bestRating: 5,
            }
          : undefined,
      }
    : null

  if (loading) {
    return (
      <main className="rehab-detail-page">
        <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>Loading facility…</div>
      </main>
    )
  }

  if (error || !center) {
    return (
      <main className="rehab-detail-page">
        <div className="container rehab-detail-error">
          <h1>Facility not found</h1>
          <p>{error || 'This listing may have been removed.'}</p>
          <Link to="/rehab-centers" className="btn">Back to directory</Link>
        </div>
      </main>
    )
  }

  const tierLabel = TIER_LABELS[center.listing_tier]

  return (
    <main className="rehab-detail-page">
      {jsonLd && <JsonLd data={jsonLd} />}
      <section className="rehab-detail-hero">
        <div className="container">
          <Link to="/rehab-centers" className="rehab-detail-back"><FaArrowLeft aria-hidden="true" /> All rehab centers</Link>
          <div className="rehab-detail-head">
            <div>
              <div className="rehab-name-row">
                <h1>{center.name}</h1>
                {center.claimed && <span className="rehab-claimed-badge">Verified listing</span>}
                {center.is_sponsored && <span className="rehab-sponsored-badge">Sponsored</span>}
                {tierLabel && <span className="rehab-tier-badge">{tierLabel}</span>}
              </div>
              <p className="rehab-detail-location">
                <FaMapMarkerAlt aria-hidden="true" /> {center.location}
              </p>
              <span className="rehab-stars" aria-label={`${center.rating} out of 5 stars`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <FaStar key={i} style={{ color: i < center.rating ? '#8c1126' : '#e5e7eb' }} />
                ))}
              </span>
            </div>
            {center.image && (
              <div className="rehab-detail-hero-img">
                <img src={center.image} alt={center.name} />
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="container rehab-detail-body">
        <div className="rehab-detail-main">
          <p className="rehab-detail-description">{center.description}</p>
          <div className="rehab-specialties">
            {(center.specialties || []).map(s => (
              <span className="rehab-tag" key={s}>{s}</span>
            ))}
          </div>
          {center.treatment_levels?.length > 0 && (
            <section className="rehab-detail-section">
              <h2>Levels of care</h2>
              <ul>{center.treatment_levels.map(t => <li key={t}>{t}</li>)}</ul>
            </section>
          )}
          {center.insurance_accepted?.length > 0 && (
            <section className="rehab-detail-section">
              <h2>Insurance accepted</h2>
              <ul>{center.insurance_accepted.map(t => <li key={t}>{t}</li>)}</ul>
            </section>
          )}
          {center.accreditations?.length > 0 && (
            <section className="rehab-detail-section">
              <h2>Accreditations</h2>
              <ul>{center.accreditations.map(t => <li key={t}>{t}</li>)}</ul>
            </section>
          )}
          {center.gallery?.length > 0 && (
            <section className="rehab-detail-gallery">
              {center.gallery.map((src, i) => (
                <img key={i} src={src} alt="" loading="lazy" />
              ))}
            </section>
          )}
          {center.is_sponsored && (
            <p className="rehab-ftc-note">
              This is a paid advertising listing. See our{' '}
              <Link to="/advertising-policy">advertising policy</Link> for details.
            </p>
          )}
        </div>

        <aside className="rehab-detail-sidebar">
          <div className="rehab-detail-cta-card">
            <h3>Get help now</h3>
            {center.phone ? (
              <a href={`tel:${center.phone.replace(/\D/g, '')}`} className="btn rehab-call-btn">
                <FaPhone aria-hidden="true" /> Call {center.name}
              </a>
            ) : (
              <p className="muted">Contact details available after the facility claims this listing.</p>
            )}
            {center.website && (
              <a href={center.website} target="_blank" rel="noopener noreferrer" className="btn btn-white-outline">
                <FaGlobe aria-hidden="true" /> Visit website
              </a>
            )}
            <a href={HELPLINE_TEL} className="btn btn-white-outline">Helpline: {HELPLINE_DISPLAY}</a>
          </div>
          <p className="rehab-detail-disclosure">
            Calls may be routed to partner treatment providers. We never charge patients for referrals.
          </p>
        </aside>
      </div>
    </main>
  )
}
