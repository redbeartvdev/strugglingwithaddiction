/** Canonical rehab service types shown in the directory search filter. */
export const REHAB_SERVICE_TYPES = [
  { id: 'inpatient', label: 'Inpatient Residential', keywords: ['inpatient', 'residential'] },
  { id: 'outpatient', label: 'Outpatient', keywords: ['outpatient'] },
  { id: 'iop', label: 'IOP (Intensive Outpatient)', keywords: ['iop', 'intensive outpatient'] },
  { id: 'php', label: 'PHP (Partial Hospitalization)', keywords: ['php', 'partial hospitalization'] },
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

/** Level-of-care options for the homepage Guided Finder (maps to `service` query param). */
export const GUIDED_CARE_LEVELS = [
  { serviceId: 'detox', label: 'Medical Detox' },
  { serviceId: 'inpatient', label: 'Residential / Inpatient' },
  { serviceId: 'php', label: 'PHP (Partial Hospitalization)' },
  { serviceId: 'iop', label: 'IOP (Intensive Outpatient)' },
  { serviceId: 'outpatient', label: 'Outpatient' },
  { serviceId: 'mat', label: 'Medication-Assisted (MAT)' },
  { serviceId: 'dual-diagnosis', label: 'Dual Diagnosis' },
]

/** Insurance types accepted by listings (`insurance` query param). */
export const REHAB_INSURANCE_TYPES = [
  { id: 'private', label: 'Private Insurance' },
  { id: 'medicaid', label: 'Medicaid' },
  { id: 'medicare', label: 'Medicare' },
  { id: 'tricare', label: 'TRICARE' },
  { id: 'va', label: 'VA Benefits' },
  { id: 'self-pay', label: 'Self-Pay / No Insurance' },
]

/** Build a directory URL using the shared query-param filter mechanism. */
export function buildRehabDirectoryUrl({ state, service, insurance } = {}) {
  const params = new URLSearchParams()
  if (state) params.set('state', state)
  if (service) params.set('service', service)
  if (insurance) params.set('insurance', insurance)
  const query = params.toString()
  return query ? `/rehab-centers?${query}` : '/rehab-centers'
}

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

export function centerInsuranceAccepted(center) {
  return center.insurance_accepted || center.insuranceAccepted || []
}

export function centerMatchesInsurance(center, insuranceId) {
  if (!insuranceId) return true
  const accepted = centerInsuranceAccepted(center)
  if (!accepted.length) return false
  return accepted.includes(insuranceId)
}
