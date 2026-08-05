/** Clean outbound links from directory listings to facility sites / phone.

Attribution only: utm_source + utm_medium. Never add carrier, plan, or user attributes.
*/

export const DIRECTORY_UTM_SOURCE = 'strugglingwithaddiction'
export const DIRECTORY_UTM_MEDIUM = 'directory'

/**
 * Append standard directory UTMs to an http(s) URL. Preserves existing query params.
 * Does not add carrier, insurance, state, or any user attribute.
 */
export function withDirectoryAttribution(url) {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return trimmed
    parsed.searchParams.set('utm_source', DIRECTORY_UTM_SOURCE)
    parsed.searchParams.set('utm_medium', DIRECTORY_UTM_MEDIUM)
    return parsed.toString()
  } catch {
    // Relative or malformed — try prefixing https
    try {
      const parsed = new URL(trimmed.startsWith('//') ? `https:${trimmed}` : `https://${trimmed}`)
      parsed.searchParams.set('utm_source', DIRECTORY_UTM_SOURCE)
      parsed.searchParams.set('utm_medium', DIRECTORY_UTM_MEDIUM)
      return parsed.toString()
    } catch {
      return trimmed
    }
  }
}

function digitsOnly(phone) {
  return String(phone || '').replace(/\D/g, '')
}

/**
 * Resolve the primary outbound CTA for a listing card / detail hero.
 * Prefer verification_url → website (with UTMs) → tel: admissions phone.
 */
export function resolveOutboundListingLink(center) {
  const verification = (center?.verification_url || '').trim()
  if (verification) {
    const href = withDirectoryAttribution(verification)
    return {
      href,
      kind: 'url',
      label: 'Check coverage',
      external: true,
    }
  }
  const website = (center?.website || '').trim()
  if (website) {
    const href = withDirectoryAttribution(website)
    return {
      href,
      kind: 'url',
      label: 'Check coverage',
      external: true,
    }
  }
  const phoneDigits = digitsOnly(center?.phone)
  if (phoneDigits) {
    return {
      href: `tel:${phoneDigits}`,
      kind: 'tel',
      label: 'Call admissions',
      external: false,
      displayPhone: center.phone,
    }
  }
  return null
}
