import './Legal.css'
import { Link } from 'react-router-dom'
import { PrivacyPolicyContent } from '../components/LegalCopy'

export default function PrivacyPolicy() {
  return (
    <main>

      <section className="legal-hero">
        <div className="container">
          <span className="section-label">Legal</span>
          <h1>Privacy Policy</h1>
          <p>How we collect, use, and protect your personal information.</p>
        </div>
      </section>

      <section className="legal-body">
        <div className="container">
          <div className="legal-content">
            <PrivacyPolicyContent />
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
