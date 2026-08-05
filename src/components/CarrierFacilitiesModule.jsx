import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FaMapMarkerAlt, FaPhone } from 'react-icons/fa'
import { fetchApi, apiEnabled } from '../lib/api'
import { buildRehabDirectoryUrl } from '../lib/rehabServices'
import { resolveOutboundListingLink } from '../lib/outboundListingLink'
import { rehabLandingPath } from '../lib/rehabLanding'

/**
 * Facilities that attest to accepting a carrier — used on coverage pages.
 * Outbound CTAs stay clean (UTMs only; never carrier=).
 */
export default function CarrierFacilitiesModule({
  insuranceName,
  state = '',
  limit = 12,
}) {
  const [centers, setCenters] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!insuranceName || !apiEnabled()) {
      setCenters([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams({ insurance: insuranceName })
    if (state) params.set('state', state)
    fetchApi(`/api/rehab-centers?${params}`)
      .then((rows) => {
        if (cancelled) return
        const list = Array.isArray(rows) ? rows : []
        setCenters(list.slice(0, limit))
      })
      .catch(() => {
        if (!cancelled) setCenters([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [insuranceName, state, limit])

  const directoryUrl = buildRehabDirectoryUrl({
    insurance: insuranceName,
    state: state || undefined,
  })

  return (
    <section className="icov-facilities" aria-labelledby="icov-facilities-heading">
      <div className="icov-facilities-head">
        <div>
          <span className="section-label">Directory</span>
          <h2 id="icov-facilities-heading">Facilities that list {insuranceName}</h2>
          <p>
            These centers self-attest that they accept {insuranceName}. Confirm benefits directly with the facility —
            we do not verify your plan.
          </p>
        </div>
        <Link className="btn" to={directoryUrl}>See all in directory</Link>
      </div>

      {loading && <p className="icov-muted">Loading matching facilities…</p>}
      {!loading && centers.length === 0 && (
        <p className="icov-muted">
          No published listings currently attest to accepting {insuranceName}
          {state ? ` in ${state}` : ''}.{' '}
          <Link to={directoryUrl}>Browse the full directory</Link>.
        </p>
      )}
      {!loading && centers.length > 0 && (
        <ul className="icov-facility-list">
          {centers.map((center) => {
            const outbound = center.claimed ? resolveOutboundListingLink(center) : null
            const landing = center.claimed ? rehabLandingPath(center) : null
            return (
              <li key={center.id} className="icov-facility-card">
                <div>
                  <h3>
                    {landing ? <Link to={landing}>{center.name}</Link> : center.name}
                  </h3>
                  {(center.location || center.city || center.state) && (
                    <p className="icov-facility-loc">
                      <FaMapMarkerAlt aria-hidden="true" />{' '}
                      {center.location || [center.city, center.state].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
                <div className="icov-facility-actions">
                  {outbound && (
                    <a
                      className="btn"
                      href={outbound.href}
                      {...(outbound.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      {outbound.label}
                    </a>
                  )}
                  {!outbound && center.phone && (
                    <a className="btn" href={`tel:${center.phone.replace(/\D/g, '')}`}>
                      <FaPhone aria-hidden="true" /> Call admissions
                    </a>
                  )}
                  {landing && (
                    <Link className="btn btn-outline" to={landing}>About listing</Link>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
