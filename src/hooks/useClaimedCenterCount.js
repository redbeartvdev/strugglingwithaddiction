import { useState, useEffect } from 'react'
import { apiEnabled, fetchApi } from '../lib/api'

/** Matches claimed entries in RehabCenters STATIC_CENTERS when API is unavailable. */
const STATIC_CLAIMED_FALLBACK = 2

export function useClaimedCenterCount(enabled = true) {
  const [count, setCount] = useState(null)

  useEffect(() => {
    if (!enabled) return
    if (!apiEnabled()) {
      setCount(STATIC_CLAIMED_FALLBACK)
      return
    }
    fetchApi('/api/rehab-centers/stats')
      .then(data => setCount(typeof data?.claimed === 'number' ? data.claimed : STATIC_CLAIMED_FALLBACK))
      .catch(() => setCount(STATIC_CLAIMED_FALLBACK))
  }, [enabled])

  return enabled ? count : null
}
