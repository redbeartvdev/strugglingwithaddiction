import './Legal.css'
import { Link } from 'react-router-dom'
import { usePageSeo } from '../hooks/usePageSeo'
import { TermsOfUseContent } from '../components/LegalCopy'

export default function TermsOfUse() {
  usePageSeo({
    title: 'Terms of Use',
    description:
      'Terms of use for Struggling With Addiction, including directory listings, articles, and provider portal access.',
    path: '/terms',
  })
  return (
    <main>

      <section className="legal-hero">
        <div className="container">
          <span className="section-label">Legal</span>
          <h1>Terms of Use</h1>
          <p>Please read these terms carefully before using our website or services.</p>
        </div>
      </section>

      <section className="legal-body">
        <div className="container">
          <div className="legal-content">
            <TermsOfUseContent />
          </div>
        </div>
      </section>

      <section className="legal-cta">
        <div className="container">
          <h2>Need Help Right Now?</h2>
          <p>
            In crisis? Call or text{' '}
            <a href="tel:988" aria-label="988 Suicide and Crisis Lifeline">988</a>{' '}
            (free, 24/7). Browse verified treatment centers in our{' '}
            <Link to="/rehab-centers">directory</Link>.
          </p>
          <Link to="/rehab-centers" className="btn">Search Treatment Centers</Link>
        </div>
      </section>

    </main>
  )
}
