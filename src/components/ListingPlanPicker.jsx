import { LISTING_FEATURES, LISTING_PLANS } from '../lib/listingPlans'

/**
 * Monthly / Annual plan picker with features + price breakdown.
 * Used on claim modal and claim-status pages.
 */
export default function ListingPlanPicker({
  onSelect,
  busy = false,
  centerName = '',
  ticket = '',
}) {
  return (
    <div className="plan-picker">
      {(centerName || ticket) && (
        <div className="plan-picker-meta">
          {centerName && (
            <p className="plan-picker-center">
              Listing subscription for <strong>{centerName}</strong>
            </p>
          )}
          {ticket && (
            <p className="plan-picker-ticket">
              Ticket: <strong>{ticket}</strong>
            </p>
          )}
          <p className="plan-picker-lead">
            Pay monthly or annually to continue. Your listing unlocks after admin verifies your certification.
          </p>
        </div>
      )}

      <div className="plan-picker-grid">
        {LISTING_PLANS.map(plan => (
          <article
            key={plan.id}
            className={`plan-card${plan.highlight ? ' plan-card-featured' : ''}`}
          >
            {plan.badge && <span className="plan-card-badge">{plan.badge}</span>}
            <h4 className="plan-card-name">{plan.name}</h4>
            <p className="plan-card-price">
              <span className="plan-card-amount">{plan.priceLabel}</span>
              <span className="plan-card-period">{plan.period}</span>
            </p>
            <p className="plan-card-note">{plan.priceNote}</p>

            <ul className="plan-card-breakdown">
              {plan.breakdown.map(row => (
                <li key={row.label} className={row.emphasize ? 'is-save' : undefined}>
                  <span>{row.label}</span>
                  <strong className={row.strike ? 'is-strike' : undefined}>{row.value}</strong>
                </li>
              ))}
            </ul>

            <ul className="plan-card-features">
              {LISTING_FEATURES.map(f => (
                <li key={f}>{f}</li>
              ))}
            </ul>

            <button
              type="button"
              className={`btn plan-card-cta${plan.highlight ? '' : ' plan-card-cta-secondary'}`}
              disabled={busy}
              onClick={() => onSelect(plan.interval)}
            >
              {busy ? 'Redirecting…' : plan.cta}
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}
