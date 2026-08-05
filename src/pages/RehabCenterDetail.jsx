import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FaMapMarkerAlt, FaPhone, FaGlobe, FaStar, FaCheckCircle, FaChevronLeft, FaChevronRight } from 'react-icons/fa'
import { MdVerified } from 'react-icons/md'
import { apiEnabled, fetchApi } from '../lib/api'
import { analyticsSessionKey, detectDevice, guessVisitorState } from '../lib/analytics'
import { STATIC_CENTERS } from './RehabCenters'
import { rehabLandingPath } from '../lib/rehabLanding'
import { formatCareLabel } from '../lib/rehabServices'
import { resolveOutboundListingLink, withDirectoryAttribution } from '../lib/outboundListingLink'
import ReviewsCarousel from '../components/ReviewsCarousel'
import './RehabCenterDetail.css'

function Stars({ rating = 5 }) {
  const value = Math.round(Number(rating) || 0)
  return (
    <span className="rpd-stars" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <FaStar key={i} className={i < value ? 'is-on' : ''} />
      ))}
    </span>
  )
}

function mapsEmbedUrl(mapsUrl, address) {
  if (mapsUrl && /\/embed/.test(mapsUrl)) return mapsUrl
  const query = address || mapsUrl || ''
  if (!query) return null
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=14&output=embed`
}

function InquiryForm({ center }) {
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', message: '' })

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (apiEnabled()) {
        const slug = center.slug || center.id
        await fetchApi(`/api/rehab-centers/${slug}/leads`, {
          method: 'POST',
          body: JSON.stringify({ ...form, source_url: window.location.href }),
        })
      }
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (submitted) {
    return (
      <div className="rpd-form-success">
        <FaCheckCircle aria-hidden="true" />
        <h3>Inquiry sent</h3>
        <p>Thanks — {center.name} will follow up soon.</p>
      </div>
    )
  }

  return (
    <form className="rpd-form" onSubmit={onSubmit}>
      <p className="rpd-form-eyebrow">Ask about treatment</p>
      <h2>Send a private inquiry</h2>
      <p className="rpd-form-copy">Four quick fields. The center replies privately to this listing.</p>
      {error && <p className="rpd-form-error">{error}</p>}
      <label>
        Full name
        <input required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
      </label>
      <label>
        Email
        <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
      </label>
      <label>
        Phone
        <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
      </label>
      <label>
        Message
        <textarea rows={4} required value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="What kind of help are you looking for?" />
      </label>
      <button type="submit" className="btn rpd-form-submit" disabled={busy}>
        {busy ? 'Sending…' : 'Send inquiry'}
      </button>
      {center.phone && (
        <a className="rpd-form-call" href={`tel:${center.phone.replace(/\D/g, '')}`}>
          <FaPhone aria-hidden="true" /> Call {center.phone}
        </a>
      )}
    </form>
  )
}

function ChipList({ items }) {
  if (!items?.length) return null
  return (
    <ul className="rpd-care-list">
      {items.map(item => <li key={item}>{formatCareLabel(item)}</li>)}
    </ul>
  )
}

function InsuranceList({ details, names }) {
  const items = (details?.length ? details : (names || []).map(name => ({ name, logo_url: null })))
  if (!items.length) return null
  return (
    <ul className="rpd-insurance-logos">
      {items.map(item => (
        <li key={item.slug || item.name}>
          {item.logo_url ? (
            <img src={item.logo_url} alt={item.name} loading="lazy" />
          ) : (
            <span className="rpd-insurance-fallback">{item.name}</span>
          )}
          <span className="rpd-insurance-name">{item.name}</span>
        </li>
      ))}
    </ul>
  )
}

function GallerySlideshow({ images, centerName }) {
  const [active, setActive] = useState(0)
  const multi = images.length > 1
  const galleryKey = images.join('|')

  useEffect(() => {
    setActive(0)
  }, [galleryKey])

  if (!images.length) return null

  const index = Math.min(active, images.length - 1)
  const go = delta => setActive(i => (i + delta + images.length) % images.length)

  return (
    <div className={`rpd-gallery${multi ? ' is-slideshow' : ' is-single'}`}>
      <figure className="rpd-gallery-main">
        <img src={images[index]} alt={`${centerName} photo ${index + 1}`} />
        {multi && (
          <>
            <button type="button" className="rpd-gallery-nav rpd-gallery-nav--prev" onClick={() => go(-1)} aria-label="Previous photo">
              <FaChevronLeft aria-hidden="true" />
            </button>
            <button type="button" className="rpd-gallery-nav rpd-gallery-nav--next" onClick={() => go(1)} aria-label="Next photo">
              <FaChevronRight aria-hidden="true" />
            </button>
            <span className="rpd-gallery-count">{index + 1} / {images.length}</span>
          </>
        )}
      </figure>
      {multi && (
        <div className="rpd-filmstrip" role="tablist" aria-label={`${centerName} photo gallery`}>
          {images.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={`rpd-filmstrip-thumb${i === index ? ' is-active' : ''}`}
              onClick={() => setActive(i)}
            >
              <img src={url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function RehabCenterDetail() {
  const { state, city, facility } = useParams()
  const [center, setCenter] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const path = `/rehabs/united-states/${state}/${city}/${facility}`
    const fromStatic = () => STATIC_CENTERS.find(item => rehabLandingPath(item) === path && item.claimed)
    let cancelled = false

    if (!apiEnabled()) {
      const staticCenter = fromStatic()
      if (staticCenter) setCenter(staticCenter)
      else setError('Listing not found')
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)

    fetchApi(`/api/rehab-centers/landing/${encodeURIComponent(state)}/${encodeURIComponent(city)}/${encodeURIComponent(facility)}`, {
      signal: controller.signal,
    })
      .then(data => {
        if (!cancelled) setCenter(data)
      })
      .catch(e => {
        if (cancelled) return
        const staticCenter = fromStatic()
        if (staticCenter) setCenter(staticCenter)
        else setError(e.name === 'AbortError' ? 'Listing not found' : e.message)
      })
      .finally(() => clearTimeout(timeout))

    return () => {
      cancelled = true
      clearTimeout(timeout)
      controller.abort()
    }
  }, [state, city, facility])

  useEffect(() => {
    if (!center?.slug || !apiEnabled()) return
    const trackedKey = `swa_viewed_${center.slug}`
    if (sessionStorage.getItem(trackedKey)) return
    sessionStorage.setItem(trackedKey, '1')
    fetchApi(`/api/rehab-centers/${encodeURIComponent(center.slug)}/views`, {
      method: 'POST',
      body: JSON.stringify({
        path: window.location.pathname,
        referrer: document.referrer || null,
        visitor_state: guessVisitorState(),
        device_type: detectDevice(),
        session_key: analyticsSessionKey(),
      }),
    }).catch(() => {})
  }, [center?.slug])

  useEffect(() => {
    if (!center) return
    const form = document.getElementById('inquiry')
    const bar = document.querySelector('.rpd-mobile-bar')
    if (!form || !bar) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        bar.classList.toggle('is-hidden', entry.isIntersecting)
      },
      { threshold: 0.15 },
    )
    observer.observe(form)
    return () => observer.disconnect()
  }, [center])

  if (error) {
    return (
      <main className="rpd-page">
        <div className="container rpd-empty">
          <h1>Listing not found</h1>
          <p>This claimed landing page is unavailable or no longer active.</p>
          <Link className="btn" to="/rehab-centers">Browse centers</Link>
        </div>
      </main>
    )
  }

  if (!center) {
    return <main className="rpd-page"><div className="container rpd-empty">Loading listing…</div></main>
  }

  const address = center.address_line
    ? `${center.address_line}, ${center.city || ''}, ${center.state || ''} ${center.zip || ''}`.replace(/\s+/g, ' ').trim()
    : center.location
  const gallery = [center.image, ...(center.gallery_urls || [])].filter(Boolean)
    .filter((url, index, all) => all.indexOf(url) === index)
  const embedUrl = mapsEmbedUrl(center.google_maps_url, address)
  const outbound = resolveOutboundListingLink(center)
  const coverageHref = outbound?.kind === 'url' ? outbound.href : null
  const websiteHref = center.website ? withDirectoryAttribution(center.website) : null
  const coverageLabel = center.verification_url ? 'Check coverage' : 'Visit website'

  return (
    <main className="rpd-page">
      <div className="rpd-hero">
        <div className="rpd-hero-media" style={center.image ? { backgroundImage: `url(${center.image})` } : undefined} />
        <div className="rpd-hero-shade" />
        <div className="container rpd-hero-inner">
          <Link to="/rehab-centers" className="rpd-back">← Back to Directory</Link>
          <div className="rpd-hero-copy">
            {center.featured && (
              <div className="rpd-badge-row">
                <span className="rpd-featured">Featured</span>
              </div>
            )}
            <div className="rpd-title-row">
              <h1>
                {center.verified_badge ? (() => {
                  const parts = String(center.name).trim().split(/\s+/)
                  const last = parts.pop()
                  const lead = parts.join(' ')
                  return (
                    <>
                      {lead ? `${lead} ` : ''}
                      <span className="rpd-title-end">
                        {last}
                        <span className="rpd-verified" title="Verified listing" aria-label="Verified listing">
                          <MdVerified aria-hidden="true" />
                        </span>
                      </span>
                    </>
                  )
                })() : center.name}
              </h1>
            </div>
            <div className="rpd-meta">
              <Stars rating={center.rating} />
              {address && <span className="rpd-address"><FaMapMarkerAlt aria-hidden="true" /> {address}</span>}
            </div>
            <div className="rpd-hero-actions">
              {center.phone && <a className="btn rpd-call-btn" href={`tel:${center.phone.replace(/\D/g, '')}`}><FaPhone aria-hidden="true" /> {center.phone}</a>}
              {coverageHref && (
                <a className="btn rpd-secondary-btn" href={coverageHref} target="_blank" rel="noopener noreferrer">
                  <FaGlobe aria-hidden="true" /> {coverageLabel}
                </a>
              )}
              {!coverageHref && outbound?.kind === 'tel' && (
                <a className="btn rpd-secondary-btn" href={outbound.href}>
                  <FaPhone aria-hidden="true" /> {outbound.label}
                </a>
              )}
              <a className="btn rpd-secondary-btn" href="#inquiry">Ask a question</a>
            </div>
          </div>
        </div>
      </div>

      {gallery.length > 0 && (
        <div className="container">
          <GallerySlideshow images={gallery} centerName={center.name} />
        </div>
      )}

      <div className="container rpd-layout">
        <div className="rpd-content">
          <section id="about" className="rpd-section">
            <h2>About {center.name}</h2>
            <p>{center.description || 'This claimed center has published its profile on Struggling With Addiction.'}</p>
            <div className="rpd-quick-links">
              {center.phone && <a href={`tel:${center.phone.replace(/\D/g, '')}`}><FaPhone aria-hidden="true" /> {center.phone}</a>}
              {coverageHref && (
                <a href={coverageHref} target="_blank" rel="noopener noreferrer">
                  <FaGlobe aria-hidden="true" /> {coverageLabel}
                </a>
              )}
              {center.contact_email && <a href={`mailto:${center.contact_email}`}>{center.contact_email}</a>}
            </div>
          </section>

          <section id="care" className="rpd-section">
            <h2>Care offered</h2>
            <div className="rpd-care-grid">
              <div>
                <h3>Services</h3>
                <ChipList items={center.specialties} />
                {!center.specialties?.length && <p className="rpd-muted">Services will appear here when the center publishes them.</p>}
              </div>
              <div>
                <h3>Levels of care</h3>
                <ChipList items={center.levels_of_care} />
                {!center.levels_of_care?.length && <p className="rpd-muted">Levels of care not listed yet.</p>}
              </div>
              <div>
                <h3>Amenities</h3>
                <ChipList items={center.amenities} />
                {!center.amenities?.length && <p className="rpd-muted">Amenities not listed yet.</p>}
              </div>
            </div>
          </section>

          <section id="insurance" className="rpd-section">
            <h2>Insurance & payment</h2>
            <InsuranceList details={center.insurance_details} names={center.insurances} />
            {!center.insurances?.length && !center.insurance_details?.length && (
              <p className="rpd-muted">Ask the center about accepted plans using the inquiry form.</p>
            )}
            {center.phone && (
              <p className="rpd-help-banner">
                Need help verifying coverage?
                <a href={`tel:${center.phone.replace(/\D/g, '')}`}>Call {center.phone}</a>
              </p>
            )}
          </section>

          <ReviewsCarousel center={center} />

          <section id="location" className="rpd-section">
            <h2>Location</h2>
            <p className="rpd-address-line"><FaMapMarkerAlt aria-hidden="true" /> {address}</p>
            {embedUrl ? (
              <div className="rpd-map">
                <iframe title={`${center.name} map`} src={embedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              </div>
            ) : (
              <p className="rpd-muted">Map link not published yet.</p>
            )}
            {center.google_maps_url && (
              <a className="btn rpd-secondary-btn" href={center.google_maps_url} target="_blank" rel="noreferrer">Open in Google Maps</a>
            )}
          </section>

          <section className="rpd-section rpd-contact-band">
            <div>
              <h2>Ready to take the next step?</h2>
              <p>Send a private inquiry or call the admissions team directly.</p>
            </div>
            <div className="rpd-contact-band-actions">
              <a className="btn rpd-call-btn" href="#inquiry">Send inquiry</a>
              {center.phone && <a className="btn rpd-secondary-btn" href={`tel:${center.phone.replace(/\D/g, '')}`}>{center.phone}</a>}
            </div>
          </section>
        </div>

        <aside className="rpd-sidebar" id="inquiry">
          <div className="rpd-sticky">
            <InquiryForm center={center} />
            <div className="rpd-side-card">
              <p className="rpd-form-eyebrow">Need a faster answer?</p>
              {center.phone ? (
                <a className="btn rpd-call-btn rpd-side-call" href={`tel:${center.phone.replace(/\D/g, '')}`}>
                  <FaPhone aria-hidden="true" /> Call now
                </a>
              ) : (
                <p className="rpd-muted">Phone available after you inquire.</p>
              )}
              {coverageHref && (
                <a className="rpd-side-link" href={coverageHref} target="_blank" rel="noopener noreferrer">
                  <FaGlobe aria-hidden="true" /> {coverageLabel}
                </a>
              )}
              {!coverageHref && websiteHref && (
                <a className="rpd-side-link" href={websiteHref} target="_blank" rel="noopener noreferrer">
                  <FaGlobe aria-hidden="true" /> Visit website
                </a>
              )}
            </div>
          </div>
        </aside>
      </div>

      <div className="rpd-mobile-bar" aria-hidden="false">
        {center.phone && (
          <a className="rpd-mobile-call" href={`tel:${center.phone.replace(/\D/g, '')}`}>
            <FaPhone aria-hidden="true" /> Call
          </a>
        )}
        <a className="rpd-mobile-cta" href="#inquiry">Send inquiry</a>
      </div>
    </main>
  )
}
