import { useState } from 'react'
import { FaMapMarkerAlt, FaPhone, FaGlobe, FaStar } from 'react-icons/fa'
import './RehabCenters.css'

const centers = [
  {
    id: 1,
    name: 'Hazelden Betty Ford Foundation',
    location: 'Rancho Mirage, California',
    phone: '1-866-831-5700',
    website: 'https://www.hazeldenbettyford.org',
    image: '/images/rehab/hazelden-betty-ford.webp',
    specialties: ['Inpatient Residential', 'Medical Detox', 'Dual Diagnosis', 'Telehealth'],
    description: 'The Betty Ford Center is a world-renowned inpatient addiction treatment facility co-founded in 1982 by former First Lady Betty Ford. Located on a serene 20-acre campus south of Palm Springs, the center combines the Minnesota Model approach with 12-Step principles and multidisciplinary care — integrating treatment for body, mind, and spirit.',
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
    description: 'Caron is a nationally recognized nonprofit provider of comprehensive addiction and behavioral health treatment, named one of America\'s best addiction treatment centers by Newsweek. The facility features state-of-the-art detoxification services, on-site medical staff, and evidence-based therapies including CBT, DBT, and equine therapy.',
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
    description: 'Ranked #1 in Newsweek\'s Best Addiction Treatment Centers in Arizona for 2025, Sierra Tucson sits on a stunning 160-acre campus with views of the Santa Catalina Mountains. Serving over 27,000 patients across 40+ years, the Sierra Tucson Model integrates medical, psychological, and family systems approaches for lasting recovery.',
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
    description: 'Located on peaceful grounds along the Piney River, The Ranch combines traditional and alternative therapies to address the whole person. The center is known for its unique equine therapy program that helps clients build trust and emotional resilience, along with extended care options for those who need additional time to establish strong recovery foundations.',
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
    description: 'The largest psychiatric teaching hospital of Harvard Medical School and ranked #1 by U.S. News & World Report, McLean Hospital offers comprehensive addiction treatment integrated with world-class psychiatric care. Programs span medical detox, inpatient residential, partial hospitalization, and intensive outpatient services using the most advanced evidence-based practices.',
    rating: 5,
  },
]

function ClaimModal({ center, onClose }) {
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = e => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        {submitted ? (
          <div className="modal-success">
            <div className="modal-success-icon">✓</div>
            <h3>Request Received!</h3>
            <p>Thank you for claiming <strong>{center.name}</strong>. Our team will review your request and reach out within 1–2 business days.</p>
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <div className="modal-header">
              <span className="section-label">Claim This Listing</span>
              <h3>{center.name}</h3>
              <p>Fill out the form below and our team will verify your ownership and get your listing updated.</p>
            </div>
            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <label>Your Name<input type="text" required placeholder="Full name" /></label>
                <label>Job Title<input type="text" required placeholder="e.g. Marketing Director" /></label>
              </div>
              <label>Work Email<input type="email" required placeholder="you@facility.com" /></label>
              <label>Phone Number<input type="tel" placeholder="(555) 000-0000" /></label>
              <label>
                How are you affiliated with this center?
                <textarea rows="3" placeholder="Briefly describe your role or ownership..." required />
              </label>
              <button type="submit" className="btn">Submit Claim Request</button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function RehabCenters() {
  const [claimCenter, setClaimCenter] = useState(null)

  return (
    <main className="rehab-page">

      {/* ── Hero ─────────────────────────────────── */}
      <section className="rehab-hero">
        <div className="rehab-hero-overlay" />
        <div className="container rehab-hero-content">
          <span className="section-label" style={{ color: '#98b8c4' }}>Find Help Near You</span>
          <h1>Trusted Rehab Centers<br />Across the USA</h1>
          <p>
            Accredited treatment facilities with proven track records of helping
            people reclaim their lives from addiction.
          </p>
        </div>
      </section>

      {/* ── Intro bar ────────────────────────────── */}
      <div className="rehab-intro-bar">
        <div className="container rehab-intro-inner">
          <p>Showing <strong>5 featured centers</strong> — Are you a treatment provider? Claim your listing to update your information.</p>
        </div>
      </div>

      {/* ── Centers list ─────────────────────────── */}
      <section className="rehab-list-section">
        <div className="container rehab-list">
          {centers.map(center => (
            <article className="rehab-card" key={center.id}>
              <div className="rehab-card-img-wrap">
                <img src={center.image} alt={center.name} loading="lazy" />
              </div>
              <div className="rehab-card-body">
                <div className="rehab-card-top">
                  <div>
                    <div className="rehab-name-row">
                      <h2>{center.name}</h2>
                      {center.claimed && <span className="rehab-claimed-badge">✓ Claimed</span>}
                    </div>
                    <div className="rehab-card-meta">
                      <span className="rehab-location">
                        <FaMapMarkerAlt aria-hidden="true" /> {center.location}
                      </span>
                      <span className="rehab-stars" aria-label={`${center.rating} out of 5 stars`}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <FaStar key={i} style={{ color: i < center.rating ? '#8c1126' : '#e5e7eb' }} />
                        ))}
                      </span>
                    </div>
                  </div>
                  {!center.claimed && (
                    <button
                      className="btn rehab-claim-btn"
                      onClick={() => setClaimCenter(center)}
                    >
                      Claim This Center
                    </button>
                  )}
                </div>

                <div className="rehab-specialties">
                  {center.specialties.map(s => (
                    <span className="rehab-tag" key={s}>{s}</span>
                  ))}
                </div>

                <p className="rehab-description">{center.description}</p>

                <div className="rehab-card-footer">
                  {center.claimed ? (
                    <>
                      <a href={`tel:${center.phone.replace(/\D/g, '')}`} className="rehab-contact">
                        <FaPhone aria-hidden="true" /> {center.phone}
                      </a>
                      <a href={center.website} target="_blank" rel="noopener noreferrer" className="rehab-contact">
                        <FaGlobe aria-hidden="true" /> Visit Website
                      </a>
                      <a href={`tel:${center.phone.replace(/\D/g, '')}`} className="btn rehab-call-btn">
                        Call Now
                      </a>
                    </>
                  ) : (
                    <p className="rehab-unclaimed-notice">
                      <FaPhone aria-hidden="true" /> Contact info available after claiming this listing.
                    </p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────── */}
      <section className="rehab-cta-section">
        <div className="container rehab-cta-inner">
          <div>
            <h2>Is Your Facility Missing?</h2>
            <p>We list accredited, high-quality treatment centers committed to ethical care. Apply to be featured on our directory.</p>
          </div>
          <div className="rehab-cta-btns">
            <button className="btn btn-white" onClick={() => setClaimCenter(centers[0])}>Submit Your Center</button>
            <a href="tel:18005551234" className="btn btn-white-outline">Call Our Team</a>
          </div>
        </div>
      </section>

      {/* ── Modal ────────────────────────────────── */}
      {claimCenter && <ClaimModal center={claimCenter} onClose={() => setClaimCenter(null)} />}

    </main>
  )
}
