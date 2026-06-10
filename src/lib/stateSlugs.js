import { US_STATES } from './usStates'

export function stateToSlug(stateName) {
  return (stateName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function slugToStateName(slug) {
  const normalized = (slug || '').toLowerCase().replace(/-/g, ' ')
  const found = US_STATES.find(s => stateToSlug(s) === slug || s.toLowerCase() === normalized)
  return found || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function cityToSlug(cityName) {
  return stateToSlug(cityName)
}

export const STATE_DIRECTORY_LINKS = US_STATES.map(name => ({
  name,
  slug: stateToSlug(name),
  href: `/rehab-centers/location/${stateToSlug(name)}`,
}))
