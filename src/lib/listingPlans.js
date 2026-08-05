/** Shared listing subscription pricing for claim + billing UIs. */

export const LISTING_MONTHLY_PRICE = 9.99
export const LISTING_YEARLY_PRICE = 99.99
export const LISTING_MONTHLY_LABEL = '$9.99'
export const LISTING_YEARLY_LABEL = '$99.99'

/** What 12 months at monthly rate would cost. */
export const LISTING_YEARLY_FULL = Math.round(LISTING_MONTHLY_PRICE * 12 * 100) / 100 // 119.88
export const LISTING_YEARLY_SAVINGS = Math.round((LISTING_YEARLY_FULL - LISTING_YEARLY_PRICE) * 100) / 100 // 19.89
export const LISTING_YEARLY_EFFECTIVE_MO = Math.round((LISTING_YEARLY_PRICE / 12) * 100) / 100 // 8.33
export const LISTING_DISCOUNT_PCT = Math.round((LISTING_YEARLY_SAVINGS / LISTING_YEARLY_FULL) * 100) // 17

export const LISTING_FEATURES = [
  'Claimed directory listing with public contact details',
  'Provider dashboard to edit your profile & media',
  'Lead inquiries inbox from visitors',
  'Partner landing page for your center',
  'Listing analytics (visits, devices, conversion)',
  'Insurance logos on your public page',
  'Invoices & billing history downloads',
]

export const LISTING_PLANS = [
  {
    id: 'year',
    interval: 'year',
    name: 'Annual',
    priceLabel: LISTING_YEARLY_LABEL,
    period: '/year',
    badge: `Save ${LISTING_DISCOUNT_PCT}%`,
    highlight: true,
    priceNote: `Only $${LISTING_YEARLY_EFFECTIVE_MO}/mo billed annually`,
    breakdown: [
      { label: '12 × monthly', value: `$${LISTING_YEARLY_FULL.toFixed(2)}`, strike: true },
      { label: 'Annual price', value: LISTING_YEARLY_LABEL },
      { label: 'You save', value: `$${LISTING_YEARLY_SAVINGS.toFixed(2)}`, emphasize: true },
    ],
    cta: 'Choose annual',
  },
  {
    id: 'month',
    interval: 'month',
    name: 'Monthly',
    priceLabel: LISTING_MONTHLY_LABEL,
    period: '/month',
    badge: null,
    highlight: false,
    priceNote: 'Flexible — cancel anytime',
    breakdown: [
      { label: 'Billed', value: 'Every month' },
      { label: 'Annual total if kept', value: `$${LISTING_YEARLY_FULL.toFixed(2)}` },
      { label: 'Commitment', value: 'Month-to-month' },
    ],
    cta: 'Choose monthly',
  },
]
