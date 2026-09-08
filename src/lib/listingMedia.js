export const LISTING_PLACEHOLDER_IMAGE = '/images/rehab/listing-placeholder.avif'
export const LISTING_PLACEHOLDER_LOGO = '/images/SWA-logo-web-white-small_vSE-1.webp'

export function isPlaceholderListingImage(center) {
  const src = center?.image || center?.image_url || center?.image_key || ''
  return !src || String(src).includes('listing-placeholder')
}

export function listingImageSrc(center) {
  if (isPlaceholderListingImage(center)) return LISTING_PLACEHOLDER_IMAGE
  return center?.image || LISTING_PLACEHOLDER_IMAGE
}
