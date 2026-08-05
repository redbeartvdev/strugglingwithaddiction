/** Shared listing subscription pricing (admin client portal). */

export const LISTING_MONTHLY_PRICE = 9.99
export const LISTING_YEARLY_PRICE = 99.99
export const LISTING_YEARLY_FULL = Math.round(LISTING_MONTHLY_PRICE * 12 * 100) / 100
export const LISTING_YEARLY_SAVINGS = Math.round((LISTING_YEARLY_FULL - LISTING_YEARLY_PRICE) * 100) / 100
export const LISTING_YEARLY_EFFECTIVE_MO = Math.round((LISTING_YEARLY_PRICE / 12) * 100) / 100
export const LISTING_DISCOUNT_PCT = Math.round((LISTING_YEARLY_SAVINGS / LISTING_YEARLY_FULL) * 100)

export const LISTING_FEATURES = [
  'Claimed directory listing with public contact details',
  'Provider dashboard to edit your profile & media',
  'Lead inquiries inbox from visitors',
  'Partner landing page for your center',
  'Listing analytics (visits, devices, conversion)',
  'Insurance logos on your public page',
  'Invoices & billing history downloads',
]
