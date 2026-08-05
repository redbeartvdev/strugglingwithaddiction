import { Link, useParams } from 'react-router-dom'
import { usePageSeo } from '../hooks/usePageSeo'
import { getInsuranceGuide, INSURANCE_GUIDES } from '../data/insuranceGuides'
import './InsuranceCoverage.css'

export default function InsuranceGuidePage() {
  const { slug } = useParams()
  const guide = getInsuranceGuide(slug)

  usePageSeo(
    guide
      ? {
          title: guide.metaTitle || guide.title,
          description: guide.metaDescription || guide.summary,
        }
      : null,
  )

  if (!guide) {
    return (
      <main className="icov-page">
        <div className="container icov-empty">
          <h1>Guide not found</h1>
          <Link className="btn" to="/insurance-coverage">Back to coverage hub</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="icov-page">
      <section className="icov-hero icov-hero--carrier">
        <div className="container icov-hero-inner">
          <p className="icov-breadcrumb">
            <Link to="/insurance-coverage">Insurance coverage</Link>
            <span aria-hidden="true"> / </span>
            <Link to="/insurance-coverage#guides">Guides</Link>
            <span aria-hidden="true"> / </span>
            <span>{guide.title}</span>
          </p>
          <h1>{guide.title}</h1>
          <p>{guide.summary}</p>
          <div className="icov-hero-actions">
            <Link className="btn" to="/rehab-centers">Browse directory</Link>
            <Link className="btn btn-outline" to="/insurance-coverage">All carriers</Link>
          </div>
        </div>
      </section>

      <section className="icov-section">
        <div className="container icov-prose">
          {guide.sections.map((s) => (
            <div key={s.heading} className="icov-guide-section">
              <h2>{s.heading}</h2>
              <p>{s.body}</p>
            </div>
          ))}
          <p className="icov-disclaimer">
            <em>
              This guide is educational and not legal or benefits advice. Coverage depends on your plan,
              state, and medical necessity. Confirm details with your insurer and the treatment facility.
            </em>
          </p>
        </div>
      </section>

      <section className="icov-section icov-section--muted">
        <div className="container">
          <div className="icov-section-head">
            <h2>More guides</h2>
          </div>
          <ul className="icov-guide-grid">
            {INSURANCE_GUIDES.filter((g) => g.slug !== guide.slug).map((g) => (
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
