import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchApi, apiEnabled } from '../lib/api'
import { buildRehabDirectoryUrl } from '../lib/rehabServices'
import { detectVisitorLocation } from '../lib/geo'
import './InsuranceAcceptedSection.css'

/** Featured commercial brands for the homepage logo strip (fallbacks when API is offline). */
const FALLBACK_INSURANCES = [
  { name: 'Aetna', slug: 'aetna', logo_url: '/images/insurance/aetna.png' },
  { name: 'Anthem', slug: 'anthem', logo_url: '/images/insurance/anthem.png' },
  { name: 'Blue Cross Blue Shield', slug: 'blue-cross-blue-shield', logo_url: '/images/insurance/blue-cross-blue-shield.png' },
  { name: 'Cigna', slug: 'cigna', logo_url: '/images/insurance/cigna.png' },
  { name: 'UnitedHealthcare', slug: 'unitedhealthcare', logo_url: '/images/insurance/unitedhealthcare.png' },
  { name: 'Humana', slug: 'humana', logo_url: '/images/insurance/humana.png' },
  { name: 'Optum', slug: 'optum', logo_url: '/images/insurance/optum.png' },
  { name: 'Tricare', slug: 'tricare', logo_url: '/images/insurance/tricare.png' },
  { name: 'Magellan Health', slug: 'magellan-health', logo_url: '/images/insurance/magellan-health.png' },
  { name: 'Beacon Health Options', slug: 'beacon-health', logo_url: '/images/insurance/beacon-health.png' },
  { name: 'ComPsych', slug: 'compsych', logo_url: '/images/insurance/compsych.png' },
  { name: 'Health Net', slug: 'health-net', logo_url: '/images/insurance/health-net.png' },
  { name: 'Optima Health', slug: 'optima-health', logo_url: '/images/insurance/optima-health.png' },
  { name: 'MultiPlan', slug: 'multiplan', logo_url: '/images/insurance/multiplan.png' },
  { name: 'AmeriHealth', slug: 'amerihealth', logo_url: '/images/insurance/amerihealth.png' },
]

const HOMEPAGE_SLUGS = new Set(FALLBACK_INSURANCES.map(i => i.slug))

export default function InsuranceAcceptedSection() {
  const [items, setItems] = useState(FALLBACK_INSURANCES)
  const [geo, setGeo] = useState({ state: '', city: '' })

  useEffect(() => {
    if (!apiEnabled()) return
    fetchApi('/api/insurances')
      .then(data => {
        if (!Array.isArray(data) || !data.length) return
        const featured = data.filter(i => HOMEPAGE_SLUGS.has(i.slug) && i.logo_url)
        const ordered = FALLBACK_INSURANCES
          .map(fb => featured.find(i => i.slug === fb.slug) || fb)
          .filter(Boolean)
        if (ordered.length) setItems(ordered)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    detectVisitorLocation()
      .then(setGeo)
      .catch(() => {})
  }, [])

  return (
    <section className="insurance-accepted-section" id="insurance-accepted" aria-labelledby="insurance-accepted-heading">
      <div className="container">
        <div className="section-header text-center">
          <span className="section-label">Insurance Accepted</span>
          <h2 id="insurance-accepted-heading">Search by the coverage you already have</h2>
          <p className="section-desc">
            Open a carrier guide to learn how coverage usually works, then browse facilities that list that plan.
            Providers manage accepted insurance from their portal so listings stay accurate.
          </p>
        </div>

        <ul className="insurance-accepted-grid">
          {items.map(item => (
            <li key={item.slug || item.name}>
              <Link
                to={`/insurance-coverage/${item.slug}`}
                className="insurance-accepted-link"
                aria-label={`Does ${item.name} cover rehab?`}
              >
                <img src={item.logo_url} alt="" loading="lazy" width={160} height={48} />
                <span>{item.name}</span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="text-center insurance-accepted-cta">
          <Link
            to={buildRehabDirectoryUrl({ state: geo.state, city: geo.city })}
            className="btn"
          >
            Browse all centers
          </Link>
          <Link to="/insurance-coverage" className="btn btn-outline" style={{ marginLeft: '0.75rem' }}>
            Insurance coverage hub
          </Link>
        </div>
      </div>
    </section>
  )
}
