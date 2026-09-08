import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiEnabled, fetchApi } from '../lib/api'
import { rehabLandingPath } from '../lib/rehabLanding'

export default function RehabLocationIndex() {
  const { state, city } = useParams()
  const [centers, setCenters] = useState([])
  const place = city ? `${city}, ${state}` : state
  useEffect(() => {
    if (!apiEnabled()) return
    const query = new URLSearchParams({ state, ...(city ? { city } : {}) })
    query.set('per_page', '100')
    fetchApi(`/api/rehab-centers?${query}`)
      .then((data) => setCenters(Array.isArray(data) ? data : (data?.items || [])))
      .catch(() => setCenters([]))
  }, [state, city])
  return <main className="container" style={{ maxWidth: 960, padding: '3rem 1rem' }}>
    <p><Link to="/rehab-centers">All rehab centers</Link></p>
    <h1>Rehab centers in {place}</h1>
    <p>Explore treatment facilities listed in our directory. Providers can claim their listing to keep information current.</p>
    {centers.length === 0 ? <p>No published centers found for this location.</p> : <ul>
      {centers.filter(center => center.claimed && rehabLandingPath(center)).map(center => <li key={center.id} style={{ margin: '1rem 0' }}>
        <Link to={rehabLandingPath(center)}><strong>{center.name}</strong></Link><br />{center.location}
      </li>)}
    </ul>}
  </main>
}
