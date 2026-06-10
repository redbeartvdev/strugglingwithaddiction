import { Link } from 'react-router-dom'
import { HELPLINE_DISPLAY, HELPLINE_TEL } from '../lib/helpline'
import './LegalPage.css'

export default function AdvertisingPolicy() {
  return (
    <main className="legal-page">
      <div className="container legal-content">
        <h1>Advertising Policy</h1>
        <p className="legal-updated">Last updated: June 2026</p>

        <section>
          <h2>Transparency</h2>
          <p>
            Struggling With Addiction is a treatment directory. Some listings are paid advertising
            placements. Sponsored and premium listings are labeled clearly on search results and
            facility profile pages.
          </p>
        </section>

        <section>
          <h2>Paid listings</h2>
          <p>
            Facilities may purchase enhanced listings (Standard, Premium, or Custom tiers). Paid
            partners may receive higher placement in search results for relevant geographic and
            service queries. Payment does not guarantee admission or a specific clinical outcome.
          </p>
        </section>

        <section>
          <h2>Calls and lead routing</h2>
          <p>
            Our helpline and click-to-call buttons may connect you with partner treatment providers.
            Calls may be recorded for quality and attribution. We disclose when routing is to paid
            advertisers at the point of contact.
          </p>
        </section>

        <section>
          <h2>Editorial independence</h2>
          <p>
            Blog and educational content is produced separately from paid listings. See our{' '}
            <Link to="/editorial-policy">editorial policy</Link> for review standards.
          </p>
        </section>

        <section>
          <h2>Advertise with us</h2>
          <p>
            Treatment providers can <Link to="/advertise">view listing options and pricing</Link>.
          </p>
        </section>

        <div className="legal-cta">
          <a href={HELPLINE_TEL} className="btn">Call {HELPLINE_DISPLAY}</a>
        </div>
      </div>
    </main>
  )
}
