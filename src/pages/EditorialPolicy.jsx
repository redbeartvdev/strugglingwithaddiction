import { Link } from 'react-router-dom'
import './LegalPage.css'

export default function EditorialPolicy() {
  return (
    <main className="legal-page">
      <div className="container legal-content">
        <h1>Editorial Policy</h1>
        <p className="legal-updated">Last updated: June 2026</p>

        <section>
          <h2>Mission</h2>
          <p>
            We publish evidence-based resources to help individuals and families find addiction
            treatment. Directory pages and blog articles are reviewed for accuracy, compassion, and
            alignment with current medical consensus.
          </p>
        </section>

        <section>
          <h2>Clinical review</h2>
          <p>
            Educational and location guide content is reviewed by qualified clinical advisors where
            noted on the page. Directory data is sourced from public records, facility submissions,
            and verified claims.
          </p>
        </section>

        <section>
          <h2>Corrections</h2>
          <p>
            To report a factual error on a listing or article, contact{' '}
            <a href="mailto:help@strugglingwithaddiction.com">help@strugglingwithaddiction.com</a>.
            We aim to respond within five business days.
          </p>
        </section>

        <section>
          <h2>Advertising separation</h2>
          <p>
            Paid listings do not influence editorial coverage. See our{' '}
            <Link to="/advertising-policy">advertising policy</Link>.
          </p>
        </section>
      </div>
    </main>
  )
}
