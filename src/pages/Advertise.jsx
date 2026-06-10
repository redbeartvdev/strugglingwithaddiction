import { Link } from 'react-router-dom'
import './Advertise.css'

const TIERS = [
  {
    id: 'free',
    name: 'Free / Claimed',
    price: '$0',
    features: ['Basic listing', 'Self-managed profile', 'Claim verification'],
  },
  {
    id: 'standard',
    name: 'Standard',
    price: '$500–$1,000 / mo',
    features: ['Enhanced profile', 'Photo gallery', 'Proximity ranking boost'],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$1,500–$2,500 / mo',
    features: ['State & city page placement', 'Live chat on profile', 'Tracked click-to-call'],
  },
  {
    id: 'custom',
    name: 'Custom / Enterprise',
    price: 'Custom',
    features: ['Featured content', 'Custom landing pages', 'Cross-network promotion'],
  },
]

export default function Advertise() {
  return (
    <main className="advertise-page">
      <section className="advertise-hero">
        <div className="container">
          <h1>Advertise With Us</h1>
          <p>
            Reach people actively searching for addiction treatment. Transparent tiers, clear
            sponsorship labels, and measurable leads.
          </p>
        </div>
      </section>

      <div className="container advertise-tiers">
        {TIERS.map(tier => (
          <article key={tier.id} className={`advertise-tier advertise-tier--${tier.id}`}>
            <h2>{tier.name}</h2>
            <p className="advertise-price">{tier.price}</p>
            <ul>
              {tier.features.map(f => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            {tier.id === 'free' ? (
              <Link to="/rehab-centers" className="btn btn-white-outline">Claim your listing</Link>
            ) : (
              <a href="mailto:partners@strugglingwithaddiction.com?subject=Listing%20inquiry" className="btn">
                Contact sales
              </a>
            )}
          </article>
        ))}
      </div>

      <div className="container advertise-footer-note">
        <p>
          Paid listings are disclosed to visitors per our{' '}
          <Link to="/advertising-policy">advertising policy</Link>. Existing partners can manage
          billing in the <a href="/admin">client portal</a>.
        </p>
      </div>
    </main>
  )
}
