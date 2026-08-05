import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchApi, apiEnabled } from '../lib/api'
import { usePageSeo } from '../hooks/usePageSeo'
import { INSURANCE_GUIDES } from '../data/insuranceGuides'
import './InsuranceCoverage.css'

const FALLBACK_HUB = [
  { name: 'Aetna', slug: 'aetna', logo_url: '/images/insurance/aetna.png', summary: 'Employer and Marketplace plans — start with facilities that list Aetna.' },
  { name: 'Blue Cross Blue Shield', slug: 'blue-cross-blue-shield', logo_url: '/images/insurance/blue-cross-blue-shield.png', summary: 'Coverage varies by local Blue plan — verify your specific card.' },
  { name: 'Cigna', slug: 'cigna', logo_url: '/images/insurance/cigna.png', summary: 'Commercial and behavioral-health managed benefits for addiction care.' },
  { name: 'UnitedHealthcare', slug: 'unitedhealthcare', logo_url: '/images/insurance/unitedhealthcare.png', summary: 'Often managed with Optum for authorizations and networks.' },
  { name: 'Tricare', slug: 'tricare', logo_url: '/images/insurance/tricare.png', summary: 'Military and family benefits — confirm TRICARE-authorized providers.' },
  { name: 'Medicaid', slug: 'medicaid', logo_url: '/images/insurance/medicaid.png', summary: 'State-specific coverage — confirm your MCO and county network.' },
]

export default function InsuranceCoverageHub() {
  const [carriers, setCarriers] = useState(FALLBACK_HUB)

  usePageSeo({
    title: 'Insurance Coverage for Rehab',
    description:
      'Does your insurance cover rehab? Learn how Aetna, Cigna, BCBS, UnitedHealthcare, Tricare, and Medicaid typically cover addiction treatment — and find facilities that list your carrier.',
  })

  useEffect(() => {
    if (!apiEnabled()) return
    fetchApi('/api/insurances?hub=true')
      .then((rows) => {
        if (!Array.isArray(rows) || !rows.length) return
        setCarriers(rows)
      })
      .catch(() => {})
  }, [])

  return (
    <main className="icov-page">
      <section className="icov-hero">
        <div className="container icov-hero-inner">
          <span className="section-label">Insurance coverage</span>
          <h1>Does your insurance cover rehab?</h1>
          <p>
            Learn how major carriers typically cover addiction treatment, then browse facilities in our directory
            that attest to accepting that plan. Listings are self-reported — always confirm benefits with the center and your insurer.
          </p>
          <div className="icov-hero-actions">
            <Link className="btn" to="/rehab-centers">Browse directory</Link>
            <a className="btn btn-outline" href="#guides">Coverage guides</a>
          </div>
        </div>
      </section>

      <section className="icov-section">
        <div className="container">
          <div className="icov-section-head">
            <h2>Coverage by carrier</h2>
            <p>Start with the plan on your card. Each page includes facilities that list that carrier.</p>
          </div>
          <ul className="icov-carrier-grid">
            {carriers.map((c) => (
              <li key={c.slug}>
                <Link to={`/insurance-coverage/${c.slug}`} className="icov-carrier-card">
                  {c.logo_url && (
                    <img src={c.logo_url} alt="" width={140} height={42} loading="lazy" />
                  )}
                  <strong>{c.hero_title || `Does ${c.name} cover rehab?`}</strong>
                  <span>{c.summary || `Learn about ${c.name} coverage and find matching facilities.`}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="icov-section icov-section--muted" id="guides">
        <div className="container">
          <div className="icov-section-head">
            <h2>Guides</h2>
            <p>Parity, EOBs, prior authorization, single case agreements, and a call script for your payer.</p>
          </div>
          <ul className="icov-guide-grid">
            {INSURANCE_GUIDES.map((g) => (
              <li key={g.slug}>
                <Link to={`/insurance-coverage/guides/${g.slug}`} className="icov-guide-card">
                  <strong>{g.title}</strong>
                  <span>{g.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}
