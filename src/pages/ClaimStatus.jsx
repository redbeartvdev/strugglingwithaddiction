import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchApi, apiEnabled } from '../lib/api'
import './RehabCenters.css'

export default function ClaimStatus() {
  const { ticket } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!apiEnabled()) {
      setError('API not configured')
      return
    }
    fetchApi(`/api/rehab/claims/${encodeURIComponent(ticket)}`)
      .then(setData)
      .catch(e => setError(e.message))
  }, [ticket])

  return (
    <main className="rehab-page" style={{ padding: '4rem 1rem' }}>
      <div className="container" style={{ maxWidth: 560 }}>
        <h1>Claim Status</h1>
        {error && <p>{error}</p>}
        {data && (
          <div className="card" style={{ marginTop: '1.5rem', padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <p><strong>Ticket:</strong> {data.ticket_number}</p>
            <p><strong>Center:</strong> {data.center_name}</p>
            <p><strong>Status:</strong> {data.status}</p>
            <p style={{ marginTop: '1rem' }}>{data.message}</p>
          </div>
        )}
        <p style={{ marginTop: '2rem' }}>
          <Link to="/rehab-centers">← Back to rehab centers</Link>
        </p>
      </div>
    </main>
  )
}
