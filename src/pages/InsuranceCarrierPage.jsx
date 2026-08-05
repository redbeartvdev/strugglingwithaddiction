import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchApi, apiEnabled } from '../lib/api'
import { usePageSeo } from '../hooks/usePageSeo'
import { buildRehabDirectoryUrl } from '../lib/rehabServices'
import { detectVisitorLocation } from '../lib/geo'
import { INSURANCE_GUIDES } from '../data/insuranceGuides'
import CarrierFacilitiesModule from '../components/CarrierFacilitiesModule'
import './InsuranceCoverage.css'

export default function InsuranceCarrierPage() {
  const { slug } = useParams()
  const [carrier, setCarrier] = useState(null)
  const [error, setError] = useState('')
  const [geo, setGeo] = useState({ state: '' })

  useEffect(() => {
    detectVisitorLocation()
      .then((loc) => setGeo({ state: loc?.state || '' }))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setError('')
    setCarrier(null)
    if (!apiEnabled()) {
      setError('Coverage pages require the API.')
      return
    }
    fetchApi(`/api/insurances/${encodeURIComponent(slug)}`)
      .then((row) => {
        if (!cancelled) setCarrier(row)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Not found')
      })
    return () => { cancelled = true }
  }, [slug])

  usePageSeo(
    carrier
      ? {
          title: carrier.meta_title || carrier.hero_title || `Does ${carrier.name} cover rehab?`,
          description: carrier.meta_description || carrier.summary || '',
          image: carrier.logo_url || undefined,
        }
      : null,
  )

  if (error) {
    return (
      <main className="icov-page">
        <div className="container icov-empty">
          <h1>Coverage page not found</h1>
          <p>{error}</p>
          <Link className="btn" to="/insurance-coverage">Back to coverage hub</Link>
        </div>
      </main>
    )
  }

  if (!carrier) {
    return (
      <main className="icov-page">
        <div className="container icov-empty">Loading…</div>
      </main>
    )
  }

  const title = carrier.hero_title || `Does ${carrier.name} cover rehab?`
  const directoryUrl = buildRehabDirectoryUrl({
    insurance: carrier.name,
    state: geo.state || undefined,
  })

  return (
    <main className="icov-page">
      <section className="icov-hero icov-hero--carrier">
        <div className="container icov-hero-inner">
          <p className="icov-breadcrumb">
            <Link to="/insurance-coverage">Insurance coverage</Link>
            <span aria-hidden="true"> / </span>
            <span>{carrier.name}</span>
          </p>
          {carrier.logo_url && (
            <img className="icov-carrier-logo" src={carrier.logo_url} alt="" width={180} height={54} />
          )}
          <h1>{title}</h1>
          {carrier.summary && <p>{carrier.summary}</p>}
          <div className="icov-hero-actions">
            <Link className="btn" to={directoryUrl}>Filter directory</Link>
            <a className="btn btn-outline" href="#facilities">Matching facilities</a>
          </div>
        </div>
      </section>

      <section className="icov-section">
        <div className="container icov-prose">
          {carrier.content_html ? (
            <div dangerouslySetInnerHTML={{ __html: carrier.content_html }} />
          ) : (
            <p>
              Many treatment programs work with {carrier.name}. Coverage depends on your specific plan,
              medical necessity, and network rules. Use the facilities below as a starting point, then
              confirm benefits with admissions and your insurer.
            </p>
          )}
        </div>
      </section>

      <div className="container" id="facilities">
        <CarrierFacilitiesModule insuranceName={carrier.name} state={geo.state} />
      </div>

      <section className="icov-section icov-section--muted">
        <div className="container">
          <div className="icov-section-head">
            <h2>Related guides</h2>
          </div>
          <ul className="icov-guide-grid">
            {INSURANCE_GUIDES.slice(0, 4).map((g) => (
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
