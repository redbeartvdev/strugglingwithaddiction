/** Canonical rehab service types shown in the search filter. */
export const REHAB_SERVICE_TYPES = [
  { id: 'inpatient', label: 'Inpatient Residential', keywords: ['inpatient', 'residential'] },
  { id: 'outpatient', label: 'Outpatient / IOP', keywords: ['outpatient', 'iop', 'intensive outpatient'] },
  { id: 'detox', label: 'Medical Detox', keywords: ['detox', 'medical detox'] },
  { id: 'dual-diagnosis', label: 'Dual Diagnosis', keywords: ['dual diagnosis', 'co-occurring', 'co occurring'] },
  { id: 'mental-health', label: 'Mental Health', keywords: ['mental health', 'behavioral health'] },
  { id: 'trauma', label: 'Trauma & PTSD', keywords: ['trauma', 'ptsd'] },
  { id: 'mat', label: 'Medication-Assisted (MAT)', keywords: ['mat', 'medication-assisted', 'medication assisted', 'suboxone', 'methadone'] },
  { id: 'telehealth', label: 'Telehealth', keywords: ['telehealth', 'virtual', 'online'] },
  { id: 'executive', label: 'Executive Program', keywords: ['executive'] },
  { id: 'equine', label: 'Equine Therapy', keywords: ['equine'] },
  { id: 'extended-care', label: 'Extended Care', keywords: ['extended care', 'long-term', 'long term'] },
  { id: 'family', label: 'Family Programs', keywords: ['family'] },
  { id: 'eating-disorders', label: 'Eating Disorders', keywords: ['eating disorder'] },
  { id: 'substance-use', label: 'Substance Use', keywords: ['substance use', 'addiction'] },
]

export function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function centerMatchesService(specialties, serviceId) {
  const service = REHAB_SERVICE_TYPES.find(s => s.id === serviceId)
  if (!service) return false
  const haystack = normalizeText((specialties || []).join(' '))
  return service.keywords.some(kw => haystack.includes(normalizeText(kw)))
}

export function specialtyMatchesAnyService(specialty, serviceIds) {
  if (!serviceIds.length) return false
  return serviceIds.some(id => {
    const service = REHAB_SERVICE_TYPES.find(s => s.id === id)
    if (!service) return false
    const haystack = normalizeText(specialty)
    return service.keywords.some(kw => haystack.includes(normalizeText(kw)))
  })
}

export function extractStateFromLocation(location) {
  if (!location) return null
  const parts = location.split(',').map(p => p.trim()).filter(Boolean)
  if (!parts.length) return null
  return parts[parts.length - 1]
}
